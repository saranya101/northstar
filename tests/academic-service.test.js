import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import {
  createAssessment,
  getAssessment,
  normalizeAssessmentName,
  updateAssessment,
  updateDeliverable
} from '../server/services/academic'

describe('academic ownership boundaries', () => {
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
    const create = vi.fn(async ({ data }) => ({ id: 'a1', ...data, createdAt: new Date(), updatedAt: new Date(), deliverables: [], milestones: [] }))
    const database = { userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(enrolment) }, assessment: { create } }
    const result = await createAssessment('user-1', 'enrol-1', { name: '  Group  Project! ', type: 'PROJECT', weight: 30, score: 18, maximumScore: 20 }, database)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', normalizedName: 'group project', percentageScore: 90, weightedScore: 27 }) }))
    expect(result.percentageScore).toBe(90)
  })

  it('preserves ownership and source fields during an update', async () => {
    const existing = { id: 'a1', userId: 'user-1', userModuleEnrolmentId: 'enrol-1', name: 'Quiz', type: 'QUIZ', weight: 20, score: null, maximumScore: null, status: 'NOT_STARTED' }
    const update = vi.fn(async ({ data }) => ({ ...existing, ...data, createdAt: new Date(), updatedAt: new Date(), deliverables: [], milestones: [] }))
    const database = { assessment: { findFirst: vi.fn().mockResolvedValue(existing), update } }
    await updateAssessment('user-1', 'a1', { status: 'IN_PROGRESS' }, database)
    expect(update.mock.calls[0][0].data).not.toHaveProperty('userId')
  })

  it('normalizes duplicate names deterministically', () => {
    expect(normalizeAssessmentName(' Group—Project #1 ')).toBe('group project 1')
  })
})
