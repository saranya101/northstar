import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { deterministicAcademicInterpretation } from '../shared/academic/intake-interpreter'
import { approveAcademicProposal, createAcademicIntake, dismissAcademicProposal, getAcademicIntake } from '../server/services/academic-intakes'

const updatedAt = new Date('2026-08-10T04:00:00.000Z')
const enrolments = [
  { id: 'enrol-ab', offering: { module: { code: 'AB1201', title: 'Analytics' } } },
  { id: 'enrol-cz', offering: { module: { code: 'CZ2001', title: 'Algorithms' } } }
]

function createDatabase({ duplicateAssessment = null, duplicateCoursework = null } = {}) {
  return {
    userModuleEnrolment: { findMany: vi.fn().mockResolvedValue(enrolments) },
    assessment: { findFirst: vi.fn().mockResolvedValue(duplicateAssessment) },
    recurringCoursework: { findFirst: vi.fn().mockResolvedValue(duplicateCoursework) },
    academicIntake: { create: vi.fn(async ({ data }) => ({ id: 'intake-1', ...data, updatedAt, createdAt: updatedAt, moduleEnrolment: null, proposals: data.proposals.create.map((item, index) => ({ id: `proposal-${index + 1}`, intakeId: 'intake-1', ...item, createdAt: updatedAt, updatedAt, appliedAt: null })) })) }
  }
}

describe('academic text interpretation', () => {
  it('retains teaching weeks and never invents a calendar date', () => {
    const result = deterministicAcademicInterpretation('AB1201 Quiz will be held Tuesday of Week 8 from 7pm to 8pm.', { moduleEnrolmentId: 'enrol-ab' })
    expect(result.proposals[0].payload.teachingWeek).toBe(8)
    expect(result.proposals[0].payload.officialDeadline).toBeNull()
  })

  it('creates an owner-scoped intake with strong matching module context', async () => {
    const database = createDatabase()
    const result = await createAcademicIntake('user-1', { rawText: 'AB1201 Quiz is Tuesday in Week 8.', moduleEnrolmentId: 'enrol-ab' }, database)
    expect(database.userModuleEnrolment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', status: 'ACTIVE' } }))
    expect(database.academicIntake.create.mock.calls[0][0].data).toMatchObject({ userId: 'user-1', moduleEnrolmentId: 'enrol-ab', status: 'PENDING_REVIEW' })
    expect(result.proposals).toHaveLength(1)
  })

  it('retains conflicting context for clarification without applying anything', async () => {
    const database = createDatabase()
    const result = await createAcademicIntake('user-1', { rawText: 'CZ2001 Quiz is now in Week 8.', moduleEnrolmentId: 'enrol-ab' }, database)
    expect(result.status).toBe('NEEDS_CLARIFICATION')
    expect(result.clarificationReason).toMatch(/conflicts with the selected AB1201/)
  })

  it('requires clarification when text references more than one active module', async () => {
    const database = createDatabase()
    const result = await createAcademicIntake('user-1', { rawText: 'AB1201 and CZ2001 quiz preparation changed.' }, database)
    expect(result.status).toBe('NEEDS_CLARIFICATION')
    expect(result.clarificationReason).toMatch(/More than one active module/)
  })

  it('marks clear duplicate assessments and coursework as conflicts', async () => {
    const interpreter = { key: 'test', interpret: vi.fn().mockResolvedValue({ category: 'NEW_ASSESSMENT', moduleEnrolmentId: 'enrol-ab', clarificationReason: null, proposals: [
      { actionType: 'CREATE_ASSESSMENT', targetType: 'ASSESSMENT', payload: { name: 'Quiz 1', type: 'QUIZ', weight: 10, officialDeadline: null } },
      { actionType: 'CREATE_COURSEWORK', targetType: 'RECURRING_COURSEWORK', payload: { title: 'LAMS', type: 'LAMS', totalExpected: 13 } }
    ] }) }
    const database = createDatabase({ duplicateAssessment: { id: 'a1', name: 'Quiz 1' }, duplicateCoursework: { id: 'c1', title: 'LAMS' } })
    const result = await createAcademicIntake('user-1', { rawText: 'AB1201 Quiz 1 and LAMS details changed.', moduleEnrolmentId: 'enrol-ab' }, database, interpreter)
    expect(result.proposals.map(item => item.status)).toEqual(['CONFLICT', 'CONFLICT'])
  })

  it('does not expose another owner’s intake', async () => {
    const database = { academicIntake: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getAcademicIntake('user-2', 'intake-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.academicIntake.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'intake-1', userId: 'user-2' } }))
  })
})

describe('proposal decisions', () => {
  const intake = { id: 'intake-1', userId: 'user-1', moduleEnrolmentId: 'enrol-ab', rawText: 'Complete tutorial before seminar.', updatedAt, proposals: [{ id: 'proposal-1', status: 'PENDING', actionType: 'CREATE_TASK', targetType: 'TASK', payload: { title: 'Complete tutorial', type: 'STUDY', timingNote: 'before seminar' } }] }

  it('applies an approved proposal transactionally', async () => {
    const tx = { academicIntake: { findFirst: vi.fn().mockResolvedValue(intake), update: vi.fn() }, academicProposal: { update: vi.fn(), count: vi.fn().mockResolvedValue(0) }, task: { create: vi.fn().mockResolvedValue({ id: 'task-1' }) } }
    const database = { $transaction: vi.fn(callback => callback(tx)) }
    await expect(approveAcademicProposal('user-1', 'intake-1', 'proposal-1', { expectedUpdatedAt: updatedAt.toISOString() }, database)).resolves.toEqual({ status: 'APPLIED', targetId: 'task-1', idempotent: false })
    expect(tx.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', moduleEnrolmentId: 'enrol-ab' }) }))
  })

  it('dismisses a proposal without mutating academic records', async () => {
    const tx = { academicIntake: { findFirst: vi.fn().mockResolvedValue(intake), update: vi.fn() }, academicProposal: { update: vi.fn() } }
    const database = { $transaction: vi.fn(callback => callback(tx)) }
    await expect(dismissAcademicProposal('user-1', 'intake-1', 'proposal-1', { expectedUpdatedAt: updatedAt.toISOString() }, database)).resolves.toEqual({ status: 'DISMISSED', idempotent: false })
    expect(tx.academicProposal.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DISMISSED' } }))
  })

  it('cannot approve an intake owned by another user', async () => {
    const tx = { academicIntake: { findFirst: vi.fn().mockResolvedValue(null) } }
    const database = { $transaction: vi.fn(callback => callback(tx)) }
    await expect(approveAcademicProposal('user-2', 'intake-1', 'proposal-1', { expectedUpdatedAt: updatedAt.toISOString() }, database)).rejects.toMatchObject({ statusCode: 404 })
    expect(tx.academicIntake.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'intake-1', userId: 'user-2' } }))
  })
})
