import { describe, expect, it } from 'vitest'
import { createOpportunitySchema, opportunityFiltersSchema, updateOpportunitySchema, updateOpportunityStatusSchema } from '../shared/schemas/opportunities'

const valid = { title: 'Software engineering internship', organisation: 'Example Labs', category: 'INTERNSHIP', sourceType: 'MANUAL', mode: 'HYBRID', tags: ['Engineering', ' engineering ', 'students'] }

describe('opportunity validation', () => {
  it('accepts a valid create and normalises optional text and tags', () => {
    const result = createOpportunitySchema.parse({ ...valid, description: '', applicationUrl: '' })
    expect(result.description).toBeNull()
    expect(result.applicationUrl).toBeNull()
    expect(result.tags).toEqual(['Engineering', 'students'])
  })

  it('requires title and organisation and rejects unknown keys', () => {
    expect(createOpportunitySchema.safeParse({ ...valid, title: '' }).success).toBe(false)
    expect(createOpportunitySchema.safeParse({ ...valid, organisation: '' }).success).toBe(false)
    expect(createOpportunitySchema.safeParse({ ...valid, fileData: 'binary' }).success).toBe(false)
    expect(createOpportunitySchema.safeParse({ ...valid, description: '<script>alert(1)</script>' }).success).toBe(false)
  })

  it('requires HTTPS URLs and valid ISO dates', () => {
    expect(createOpportunitySchema.safeParse({ ...valid, sourceUrl: 'http://example.com' }).success).toBe(true)
    expect(createOpportunitySchema.safeParse({ ...valid, applicationUrl: 'http://example.com/apply' }).success).toBe(false)
    expect(createOpportunitySchema.safeParse({ ...valid, sourceUrl: 'https://example.com' }).success).toBe(true)
    expect(createOpportunitySchema.safeParse({ ...valid, deadline: '12 August 2026' }).success).toBe(false)
    expect(createOpportunitySchema.safeParse({ ...valid, deadline: '2026-08-12T15:59:00+08:00' }).success).toBe(true)
  })

  it('rejects end dates before start dates on create and update', () => {
    const dates = { startAt: '2026-08-12T10:00:00+08:00', endAt: '2026-08-11T10:00:00+08:00' }
    expect(createOpportunitySchema.safeParse({ ...valid, ...dates }).success).toBe(false)
    expect(updateOpportunitySchema.safeParse(dates).success).toBe(false)
  })

  it('validates personal deadlines and strict filter/status payloads', () => {
    expect(updateOpportunityStatusSchema.safeParse({ personalDeadline: 'tomorrow' }).success).toBe(false)
    expect(updateOpportunityStatusSchema.safeParse({ status: 'APPLIED', extra: true }).success).toBe(false)
    expect(opportunityFiltersSchema.parse({ category: 'HACKATHON', expired: 'true' })).toMatchObject({ category: 'HACKATHON', expired: true })
    expect(opportunityFiltersSchema.safeParse({ hidden: 'yes' }).success).toBe(false)
  })
})
