import { describe, expect, it } from 'vitest'
import { assessmentInputSchema } from '../shared/schemas/academic'
import { academicProposalResultSchema, createAcademicIntakeSchema, proposalDecisionSchema } from '../shared/schemas/academic-intake'

describe('academic API validation', () => {
  it('validates weights, score pairs and deadline order', () => {
    const base = { name: 'Quiz', type: 'QUIZ', weight: 20, score: 8, maximumScore: 10 }
    expect(assessmentInputSchema.safeParse(base).success).toBe(true)
    expect(assessmentInputSchema.safeParse({ ...base, weight: 101 }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, maximumScore: null }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, officialDeadline: '2026-10-10T00:00:00.000Z', internalDeadline: '2026-10-11T00:00:00.000Z' }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, eventDate: '2026-11-23T05:00:00.000Z', eventEndDate: '2026-11-23T04:00:00.000Z' }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, eventDate: '2026-11-23T05:00:00.000Z', eventEndDate: '2026-11-23T07:30:00.000Z' }).success).toBe(true)
  })

  it('accepts text intake and normalizes blank optional module context', () => {
    const parsed = createAcademicIntakeSchema.parse({ rawText: 'AB1201 quiz is in Week 8.', moduleEnrolmentId: '' })
    expect(parsed.moduleEnrolmentId).toBeUndefined()
    expect(createAcademicIntakeSchema.safeParse({ rawText: 'too short', rawFile: 'bytes' }).success).toBe(false)
  })

  it('requires strict validated proposals and optimistic review tokens', () => {
    const proposal = { category: 'TASK', moduleEnrolmentId: 'enrol-1', clarificationReason: null, proposals: [{ actionType: 'CREATE_TASK', targetType: 'TASK', payload: { title: 'Prepare tutorial', dueAt: null } }] }
    expect(academicProposalResultSchema.safeParse(proposal).success).toBe(true)
    expect(academicProposalResultSchema.safeParse({ ...proposal, proposals: [{ ...proposal.proposals[0], actionType: 'DELETE_TASK' }] }).success).toBe(false)
    expect(proposalDecisionSchema.safeParse({ expectedUpdatedAt: '2026-08-10T00:00:00.000Z' }).success).toBe(true)
    expect(proposalDecisionSchema.safeParse({}).success).toBe(false)
  })
})
