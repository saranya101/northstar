import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { confirmTimetableImport, deleteClassSession, getTimetableImport, sourceSemesterStatus, updateClassSession } from '../server/services/timetable'

describe('source semester validation', () => {
  it('detects matches, mismatches and unknown uploads deterministically', () => {
    const source = { academicYearLabel: '2025/2026', semesterNumber: 2 }
    expect(sourceSemesterStatus(source, { academicYear: '2025/2026', semesterNumber: 2, name: 'Semester 2' })).toBe('MATCH')
    expect(sourceSemesterStatus(source, { academicYear: '2026/2027', semesterNumber: 1, name: 'Semester 1' })).toBe('MISMATCH')
    expect(sourceSemesterStatus(null, { academicYear: '2026/2027', semesterNumber: 1 })).toBe('UNKNOWN')
  })
})

describe('timetable ownership', () => {
  it('returns 404 when another user reads an import', async () => {
    const database = { timetableImport: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getTimetableImport('other-user', 'import-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.timetableImport.findFirst).toHaveBeenCalledWith({ where: { id: 'import-1', userId: 'other-user' } })
  })
  it('does not edit or delete another user session', async () => {
    const database = { classSession: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), delete: vi.fn() } }
    await expect(updateClassSession('other-user', 'session-1', { venue: 'TR+1' }, database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteClassSession('other-user', 'session-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.classSession.update).not.toHaveBeenCalled()
    expect(database.classSession.delete).not.toHaveBeenCalled()
  })
})

describe('import confirmation concurrency', () => {
  it('rejects stale confirmation before any academic writes', async () => {
    const transaction = {
      timetableImport: { findFirst: vi.fn().mockResolvedValue({ id: 'import-1', userId: 'user-1', status: 'NEEDS_REVIEW', updatedAt: new Date('2026-07-21T00:00:00.000Z') }) },
      module: { create: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: '2026-07-21T00:00:01.000Z', modules: [] }, database)).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.module.create).not.toHaveBeenCalled()
  })
  it('rejects an already confirmed import', async () => {
    const transaction = { timetableImport: { findFirst: vi.fn().mockResolvedValue({ id: 'import-1', status: 'CONFIRMED', updatedAt: new Date() }) } }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: new Date().toISOString(), modules: [] }, database)).rejects.toMatchObject({ statusCode: 409 })
  })
  it('rejects structural extraction mismatches before module or session writes', async () => {
    const updatedAt = new Date('2026-07-21T00:00:00.000Z')
    const transaction = {
      timetableImport: { findFirst: vi.fn().mockResolvedValue({
        id: 'import-1', userId: 'user-1', userSemesterId: 'semester-1', status: 'NEEDS_REVIEW', updatedAt,
        candidatePayload: {
          sourceSemester: { academicYearLabel: '2026/2027', semesterNumber: 1, displayLabel: '2026/2027 Semester 1' },
          sourceSummary: { moduleCount: 6, totalAcademicUnits: 16 },
          structure: { gridVisible: true, gridModuleCodes: ['AB1201'], examRowsDetected: 6 }
        }
      }) },
      userAcademicProfile: { findUnique: vi.fn().mockResolvedValue({ universityId: 'u1' }) },
      userSemester: { findFirst: vi.fn().mockResolvedValue({ id: 'semester-1', academicTermId: 'term-1', academicTerm: { universityId: 'u1', academicYear: '2026/2027', semesterNumber: 1, name: 'Semester 1' } }) },
      module: { create: vi.fn() },
      classSession: { create: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: updatedAt.toISOString(), modules: [] }, database)).rejects.toMatchObject({ statusCode: 409, statusMessage: 'Resolve the structural timetable import issues before confirming.' })
    expect(transaction.module.create).not.toHaveBeenCalled()
    expect(transaction.classSession.create).not.toHaveBeenCalled()
  })
  it('reuses an enrolment and skips an identical session on a repeated import', async () => {
    const updatedAt = new Date('2026-07-21T00:00:00.000Z')
    const moduleCandidate = {
      candidateId: 'm1', code: 'AB1201', title: 'Financial Management', academicUnits: 3, indexNumber: '00105',
      courseType: null, registrationStatus: 'REGISTERED', selected: true, publicEnrichment: null,
      sessions: [{ candidateId: 's1', selected: true, classType: 'SEMINAR', groupLabel: '11', dayOfWeek: 'TUESDAY', startMinutes: 810, endMinutes: 980, venue: 'ESR4', deliveryMode: 'IN_PERSON', recurrence: 'WEEKLY', weekNumbers: [], confidence: 0.9 }]
    }
    const transaction = {
      timetableImport: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'import-1', userId: 'user-1', userSemesterId: 'semester-1', status: 'NEEDS_REVIEW', updatedAt,
          candidatePayload: {
            sourceSemester: { academicYearLabel: '2026/2027', semesterNumber: 1, displayLabel: '2026/2027 Semester 1' },
            sourceSummary: { moduleCount: 1, totalAcademicUnits: 3 },
            structure: { gridVisible: true, gridModuleCodes: ['AB1201'], examRowsDetected: 0 }
          }
        }),
        update: vi.fn().mockResolvedValue({})
      },
      userAcademicProfile: { findUnique: vi.fn().mockResolvedValue({ universityId: 'u1', schoolId: 'school-1' }) },
      userSemester: { findFirst: vi.fn().mockResolvedValue({ id: 'semester-1', academicTermId: 'term-1', academicTerm: { universityId: 'u1', academicYear: '2026/2027', semesterNumber: 1, name: 'Semester 1' } }) },
      module: { findUnique: vi.fn().mockResolvedValue({ id: 'module-1', sourceStatus: 'USER_ENTERED', academicUnits: 3, description: null, gradingBasis: null, officialUrl: null }), create: vi.fn(), update: vi.fn() },
      moduleOffering: { upsert: vi.fn().mockResolvedValue({ id: 'offering-1' }) },
      userModuleEnrolment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'enrolment-1' }),
        update: vi.fn().mockResolvedValue({ id: 'enrolment-1' }),
        create: vi.fn()
      },
      classSession: {
        findUnique: vi.fn().mockResolvedValue({ id: 'session-existing' }),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([])
      }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: updatedAt.toISOString(), modules: [moduleCandidate] }, database)).resolves.toMatchObject({ modulesReused: 1, sessionsCreated: 0, duplicatesSkipped: 1 })
    expect(transaction.userModuleEnrolment.create).not.toHaveBeenCalled()
    expect(transaction.classSession.create).not.toHaveBeenCalled()
  })
})
