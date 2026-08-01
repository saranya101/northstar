import { describe, expect, it } from 'vitest'
import {
  assessmentInputSchema,
  createCourseDocumentSchema,
  createCourseOutlineImportSchema,
  reviewCourseDocumentSchema,
  updateCourseOutlineImportSchema
} from '../shared/schemas/academic'

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

  it('accepts supported course documents and rejects unsafe file metadata', () => {
    const valid = {
      documentType: 'ASSESSMENT_BRIEF',
      displayTitle: 'Group report brief',
      originalFileName: 'brief.pdf',
      mimeType: 'application/pdf',
      fileSize: 250_000,
      sha256Hash: 'a'.repeat(64),
      sourceType: 'PDF',
      sourceDate: '2026-08-01T00:00:00.000Z',
      extractedText: 'A sufficiently long assessment brief for the group report.',
      extractionConfidence: 0.95
    }

    expect(createCourseDocumentSchema.safeParse(valid).success).toBe(true)
    expect(createCourseDocumentSchema.safeParse({ ...valid, mimeType: 'application/zip' }).success).toBe(false)
    expect(createCourseDocumentSchema.safeParse({ ...valid, fileSize: 11 * 1024 * 1024 }).success).toBe(false)
    expect(createCourseDocumentSchema.safeParse({ ...valid, sha256Hash: 'not-a-hash' }).success).toBe(false)
    expect(createCourseDocumentSchema.safeParse({ ...valid, rawFile: 'bytes' }).success).toBe(false)
  })

  it('requires explicit document proposal decisions and stale-write protection', () => {
    const valid = {
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
      decisions: [{ id: 'proposal-1', action: 'APPROVE', proposedValue: 'Updated instructions' }]
    }

    expect(reviewCourseDocumentSchema.safeParse(valid).success).toBe(true)
    expect(reviewCourseDocumentSchema.safeParse({ decisions: valid.decisions }).success).toBe(false)
    expect(reviewCourseDocumentSchema.safeParse({ ...valid, decisions: [{ id: 'proposal-1', action: 'IGNORE' }] }).success).toBe(false)
  })
})
