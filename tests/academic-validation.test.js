import { describe, expect, it } from 'vitest'
import { assessmentInputSchema, createCourseOutlineImportSchema, updateCourseOutlineImportSchema } from '../shared/schemas/academic'

describe('academic API validation', () => {
  it('accepts safe outline text but rejects raw file-shaped fields', () => {
    const valid = { sourceType: 'TEXT', sourceLabel: 'Pasted outline', extractedText: 'A sufficiently long course outline with Quiz 20%.' }
    expect(createCourseOutlineImportSchema.safeParse(valid).success).toBe(true)
    expect(createCourseOutlineImportSchema.safeParse({ ...valid, rawFile: 'bytes' }).success).toBe(false)
  })

  it('validates weights, score pairs and deadline order', () => {
    const base = { name: 'Quiz', type: 'QUIZ', weight: 20, score: 8, maximumScore: 10 }
    expect(assessmentInputSchema.safeParse(base).success).toBe(true)
    expect(assessmentInputSchema.safeParse({ ...base, weight: 101 }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, maximumScore: null }).success).toBe(false)
    expect(assessmentInputSchema.safeParse({ ...base, officialDeadline: '2026-10-10T00:00:00.000Z', internalDeadline: '2026-10-11T00:00:00.000Z' }).success).toBe(false)
  })

  it('requires stale-write protection on review updates', () => {
    expect(updateCourseOutlineImportSchema.safeParse({ expectedUpdatedAt: '2026-07-28T00:00:00.000Z', candidates: [] }).success).toBe(true)
    expect(updateCourseOutlineImportSchema.safeParse({ candidates: [] }).success).toBe(false)
  })
})
