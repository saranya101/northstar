import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))

import {
  addModuleInstructor,
  closeModuleEnrolment,
  createManualModule,
  enrolExistingModule,
  getModuleDossier,
  listModules,
  requireModuleContext,
  searchModules,
  updateModuleEnrolment
} from '../server/services/modules'

const academicProfile = { universityId: 'u1', schoolId: 's1', university: { name: 'University' }, school: {}, programme: {} }
const activeSemester = { id: 'us1', academicTermId: 't1', academicTerm: { id: 't1', universityId: 'u1', academicYear: '2026/27', name: 'Semester 1' } }
const moduleRecord = { id: 'm1', universityId: 'u1', schoolId: 's1', code: 'TMP1001', title: 'Temporary module', description: null, academicUnits: null, sourceStatus: 'USER_ENTERED', lastVerifiedAt: null }
const offering = { id: 'o1', moduleId: 'm1', academicTermId: 't1', sectionLabel: 'DEFAULT' }

function contextModels(overrides = {}) {
  return {
    userAcademicProfile: { findUnique: vi.fn().mockResolvedValue(academicProfile) },
    userSemester: { findFirst: vi.fn().mockResolvedValue(activeSemester) },
    ...overrides
  }
}

function serializedEnrolment(extra = {}) {
  return {
    id: 'e1', targetGrade: null, personalNotes: 'private', colour: 'MINERAL', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
    offering: {
      ...offering,
      module: moduleRecord,
      academicTerm: activeSemester.academicTerm,
      instructorAssignments: [],
      ...extra
    }
  }
}

function importedEnrolment(code, academicUnits, sessionCount, indexNumber, extra = {}) {
  return {
    id: `e-${code}`, userId: 'user-1', userSemesterId: 'us1', targetGrade: null, colour: 'MINERAL', status: 'ACTIVE',
    indexNumber, courseType: null, registrationStatus: 'REGISTERED', createdAt: new Date(), updatedAt: new Date(),
    _count: { classSessions: sessionCount },
    offering: {
      id: `o-${code}`, sectionLabel: 'DEFAULT', academicTerm: activeSemester.academicTerm, instructorAssignments: [],
      module: { ...moduleRecord, id: `m-${code}`, code, title: extra.title || code, academicUnits, description: extra.description ?? null }
    }
  }
}

describe('module academic context', () => {
  it('requires an academic profile', async () => {
    const database = contextModels({ userAcademicProfile: { findUnique: vi.fn().mockResolvedValue(null) } })
    await expect(requireModuleContext('user-1', database)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('requires an active semester', async () => {
    const database = contextModels({ userSemester: { findFirst: vi.fn().mockResolvedValue(null) } })
    await expect(requireModuleContext('user-1', database)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('active-semester module listing', () => {
  it('returns all six imported enrolments with AU, index and session counts', async () => {
    const records = [
      importedEnrolment('AB0403', 3, 1, '00462', { title: 'DECISION MAKING WITH PROGRAMMING & ANALYTICS' }),
      importedEnrolment('AB1088', 1, 2, '01215', { title: 'CAREER LAUNCHPAD' }),
      importedEnrolment('AB1201', 3, 1, '00105', { title: 'FINANCIAL MANAGEMENT' }),
      importedEnrolment('AB1501', 3, 2, '00879', { title: 'MARKETING' }),
      importedEnrolment('AD1102', 3, 1, '01128', { title: 'FINANCIAL ACCOUNTING' }),
      importedEnrolment('HE5091', 3, 2, '01062', { title: 'PRINCIPLES OF ECONOMICS' })
    ]
    const findMany = vi.fn().mockResolvedValue(records)
    const database = contextModels({ userModuleEnrolment: { findMany } })
    const result = await listModules('user-1', 'ACTIVE', database)

    expect(result.modules).toHaveLength(6)
    expect(result.modules.map(module => module.code)).toEqual(['AB0403', 'AB1088', 'AB1201', 'AB1501', 'AD1102', 'HE5091'])
    expect(result.modules.reduce((total, module) => total + module.academicUnits, 0)).toBe(16)
    expect(Object.fromEntries(result.modules.map(module => [module.code, module.sessionCount]))).toEqual({
      AB0403: 1, AB1088: 2, AB1201: 1, AB1501: 2, AD1102: 1, HE5091: 2
    })
    expect(result.modules.find(module => module.code === 'HE5091')).toMatchObject({
      title: 'Principles of Economics', indexNumber: '01062', registrationStatus: 'REGISTERED'
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', userSemesterId: 'us1', status: 'ACTIVE' },
      include: expect.objectContaining({ _count: { select: { classSessions: true } } })
    }))
  })

  it('does not hide an imported enrolment when optional module fields are missing', async () => {
    const record = importedEnrolment('AB1088', 1, 2, '01215', { title: 'CAREER LAUNCHPAD', description: null })
    record.offering.module.lastVerifiedAt = null
    const database = contextModels({ userModuleEnrolment: { findMany: vi.fn().mockResolvedValue([record]) } })
    const result = await listModules('user-1', 'ACTIVE', database)
    expect(result.modules).toEqual([expect.objectContaining({ code: 'AB1088', description: null, sessionCount: 2 })])
  })
})

describe('module catalogue boundaries', () => {
  it('limits search to the user university and current user enrolments', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const database = contextModels({ module: { findMany } })
    await searchModules('user-1', 'tmp', database)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ universityId: 'u1' }),
      select: expect.objectContaining({
        id: true,
        code: true,
        title: true,
        sourceStatus: true,
        offerings: expect.objectContaining({ select: { enrolments: { where: { userId: 'user-1' }, select: { id: true } } } })
      }),
      take: 20
    }))
  })

  it('rejects enrolment in a module from another university', async () => {
    const transaction = contextModels({ module: { findUnique: vi.fn().mockResolvedValue({ ...moduleRecord, universityId: 'u2' }) } })
    const database = { $transaction: callback => callback(transaction) }
    await expect(enrolExistingModule('user-1', { moduleId: 'm1', colour: 'MINERAL' }, database)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('manual module creation', () => {
  let transaction
  let database

  beforeEach(() => {
    transaction = contextModels({
      module: { findUnique: vi.fn().mockResolvedValue(moduleRecord), create: vi.fn(), update: vi.fn() },
      moduleOffering: { upsert: vi.fn().mockResolvedValue(offering) },
      userModuleEnrolment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(serializedEnrolment())
      }
    })
    database = { $transaction: callback => callback(transaction) }
  })

  it('reuses a permanent module and the correct term offering', async () => {
    await createManualModule('user-1', { code: ' tmp1001 ', title: 'Temporary module', colour: 'MINERAL' }, database)
    expect(transaction.module.create).not.toHaveBeenCalled()
    expect(transaction.moduleOffering.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { moduleId_academicTermId_sectionLabel: { moduleId: 'm1', academicTermId: 't1', sectionLabel: 'DEFAULT' } }
    }))
  })

  it('normalises missing sections to DEFAULT and rejects duplicate enrolment', async () => {
    transaction.userModuleEnrolment.findUnique.mockResolvedValue({ id: 'existing' })
    await expect(createManualModule('user-1', { code: 'tmp1001', title: 'Temporary module', colour: 'MINERAL' }, database)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not downgrade official module data', async () => {
    transaction.module.findUnique.mockResolvedValue({ ...moduleRecord, sourceStatus: 'OFFICIAL_CURRENT' })
    await createManualModule('user-1', { code: 'tmp1001', title: 'Different title', description: 'User text', colour: 'MINERAL' }, database)
    expect(transaction.module.update).not.toHaveBeenCalled()
  })

  it('retries one transient transaction-start failure', async () => {
    const transactionFailure = Object.assign(new Error('transaction unavailable'), { code: 'P2028' })
    const retryingDatabase = {
      $transaction: vi.fn()
        .mockRejectedValueOnce(transactionFailure)
        .mockImplementationOnce(callback => callback(transaction))
    }
    await expect(createManualModule('user-1', { code: 'tmp1001', title: 'Temporary module', colour: 'MINERAL' }, retryingDatabase)).resolves.toMatchObject({ code: 'TMP1001' })
    expect(retryingDatabase.$transaction).toHaveBeenCalledTimes(2)
  })
})

describe('private enrolment ownership', () => {
  it('returns 404 when another user requests a dossier', async () => {
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getModuleDossier('user-2', 'e1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.userModuleEnrolment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1', userId: 'user-2' } }))
  })

  it('does not update another user enrolment', async () => {
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } }
    await expect(updateModuleEnrolment('user-2', 'e1', { targetGrade: 'A' }, database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.userModuleEnrolment.update).not.toHaveBeenCalled()
  })

  it('does not drop or archive another user enrolment', async () => {
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } }
    await expect(closeModuleEnrolment('user-2', 'e1', 'drop', database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(closeModuleEnrolment('user-2', 'e1', 'archive', database)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('drops only the private enrolment and preserves the shared module', async () => {
    const update = vi.fn().mockResolvedValue(serializedEnrolment())
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue({ id: 'e1' }), update }, module: { delete: vi.fn() } }
    await closeModuleEnrolment('user-1', 'e1', 'drop', database)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DROPPED' } }))
    expect(database.module.delete).not.toHaveBeenCalled()
  })

  it('never includes private notes in an enrolment summary', async () => {
    const update = vi.fn().mockResolvedValue(serializedEnrolment())
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue({ id: 'e1' }), update } }
    const result = await updateModuleEnrolment('user-1', 'e1', { targetGrade: 'A' }, database)
    expect(result).not.toHaveProperty('personalNotes')
  })
})

describe('instructor assignment', () => {
  it('rejects a duplicate instructor-role assignment', async () => {
    const transaction = {
      userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue({ offeringId: 'o1', offering: { module: moduleRecord } }) },
      instructor: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', fullName: 'Avery Tan' }) },
      instructorAssignment: { findUnique: vi.fn().mockResolvedValue({ id: 'a1' }), create: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(addModuleInstructor('user-1', 'e1', { fullName: 'Avery Tan', role: 'LECTURER' }, database)).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.instructorAssignment.create).not.toHaveBeenCalled()
  })
})
