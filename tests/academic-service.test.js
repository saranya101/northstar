import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import {
  confirmCourseOutlineImport,
  createAssessment,
  deleteCourseOutlineImport,
  getAssessment,
  getCourseOutlineImport,
  normalizeAssessmentName,
  updateAssessment,
  updateDeliverable
} from '../server/services/academic'

describe('academic ownership boundaries', () => {
  it('does not expose another user import', async () => {
    const database = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getCourseOutlineImport('other-user', 'import-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.courseOutlineImport.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'import-1', userId: 'other-user' } }))
  })

  it('does not expose another user assessment', async () => {
    const database = { assessment: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getAssessment('other-user', 'assessment-1', database)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('checks assessment ownership before changing a deliverable', async () => {
    const database = { assessment: { findFirst: vi.fn().mockResolvedValue(null) }, assessmentDeliverable: { updateMany: vi.fn() } }
    await expect(updateDeliverable('other-user', 'assessment-1', 'deliverable-1', { completed: true }, database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.assessmentDeliverable.updateMany).not.toHaveBeenCalled()
  })
})

describe('assessment records', () => {
  const enrolment = { id: 'enrol-1', targetPercentage: null, targetLabel: null, offering: { module: {}, academicTerm: {}, instructorAssignments: [] } }

  it('creates a manual assessment with derived score fields and normalized identity', async () => {
    const create = vi.fn(async ({ data }) => ({ id: 'a1', ...data, createdAt: new Date(), updatedAt: new Date(), provenance: [], deliverables: [], milestones: [] }))
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(enrolment) }, assessment: { create } }
    const result = await createAssessment('user-1', 'enrol-1', { name: '  Group  Project! ', type: 'PROJECT', weight: 30, score: 18, maximumScore: 20 }, database)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', normalizedName: 'group project', percentageScore: 90, weightedScore: 27 }) }))
    expect(result.percentageScore).toBe(90)
  })

  it('preserves ownership and source fields during an update', async () => {
    const existing = { id: 'a1', userId: 'user-1', userModuleEnrolmentId: 'enrol-1', sourceImportId: 'import-1', name: 'Quiz', type: 'QUIZ', weight: 20, score: null, maximumScore: null, status: 'NOT_STARTED' }
    const update = vi.fn(async ({ data }) => ({ ...existing, ...data, createdAt: new Date(), updatedAt: new Date(), provenance: [], deliverables: [], milestones: [] }))
    const database = { assessment: { findFirst: vi.fn().mockResolvedValue(existing), update } }
    await updateAssessment('user-1', 'a1', { status: 'IN_PROGRESS' }, database)
    expect(update.mock.calls[0][0].data).not.toHaveProperty('userId')
    expect(update.mock.calls[0][0].data).not.toHaveProperty('sourceImportId')
  })

  it('normalizes duplicate names deterministically', () => {
    expect(normalizeAssessmentName(' Group—Project #1 ')).toBe('group project 1')
  })
})

describe('course outline confirmation', () => {
  const now = new Date('2026-07-28T00:00:00.000Z')
  it('is idempotent after confirmation', async () => {
    const transaction = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', status: 'CONFIRMED', assessments: [{ id: 'a1' }], candidates: [] }) }, assessment: { create: vi.fn() } }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmCourseOutlineImport('user-1', 'i1', { expectedUpdatedAt: now.toISOString() }, database)).resolves.toEqual({ status: 'CONFIRMED', createdCount: 0, assessmentIds: ['a1'], idempotent: true })
    expect(transaction.assessment.create).not.toHaveBeenCalled()
  })

  it('rejects a stale review before any writes', async () => {
    const transaction = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', status: 'REVIEW_REQUIRED', updatedAt: now, candidates: [], assessments: [] }) }, assessment: { create: vi.fn() } }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmCourseOutlineImport('user-1', 'i1', { expectedUpdatedAt: '2026-07-28T00:00:01.000Z' }, database)).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.assessment.create).not.toHaveBeenCalled()
  })

  it('returns deterministic duplicate conflicts before creation', async () => {
    const candidate = { id: 'c1', name: 'Quiz', type: 'QUIZ', weight: 20, officialDeadline: null, provenance: [] }
    const transaction = {
      courseOutlineImport: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', userModuleEnrolmentId: 'e1', status: 'REVIEW_REQUIRED', updatedAt: now, candidates: [candidate], assessments: [] }) },
      assessment: { findFirst: vi.fn().mockResolvedValue({ id: 'a1', name: 'Quiz' }), create: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmCourseOutlineImport('user-1', 'i1', { expectedUpdatedAt: now.toISOString() }, database)).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.assessment.create).not.toHaveBeenCalled()
  })

  it('preserves an import referenced by assessments', async () => {
    const database = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', status: 'CONFIRMED', _count: { assessments: 1 } }), delete: vi.fn() } }
    await expect(deleteCourseOutlineImport('user-1', 'i1', database)).rejects.toMatchObject({ statusCode: 409 })
    expect(database.courseOutlineImport.delete).not.toHaveBeenCalled()
  })
})
