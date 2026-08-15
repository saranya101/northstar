import { describe, expect, it } from 'vitest'
import { createMailBatchSchema, createMailIntakeSchema } from '../shared/schemas/mail-intake.js'
import { classifyMailText, deterministicMailInterpretation } from '../server/services/mail-intelligence.js'
import { NTU_MAIL_FIXTURES } from './fixtures/ntu-mail.js'

describe('deterministic NTU mail intelligence', () => {
  it.each([
    ['ccaRecruitment', 'OPPORTUNITY'], ['internship', 'OPPORTUNITY'], ['competition', 'OPPORTUNITY'],
    ['exchange', 'OPPORTUNITY'], ['scholarship', 'OPPORTUNITY'], ['mentorship', 'OPPORTUNITY'],
    ['requiredAdmin', 'ACTION_REQUIRED'], ['venueChange', 'ACADEMIC_ADMIN'], ['networkingEvent', 'EVENT'],
    ['newsletter', 'NOISE'], ['ambiguous', 'UNCERTAIN']
  ])('classifies the synthetic %s fixture as %s', (fixture, category) => {
    const result = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES[fixture] })
    expect(result.classification.category).toBe(category)
    expect(result.classification.reasons.length).toBeGreaterThan(0)
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.classification.confidenceBand)
  })

  it('parses obvious headers and extracts only an exact deadline', () => {
    const result = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES.ccaRecruitment })
    expect(result.metadata).toMatchObject({ subject: 'IBC Sales & Trading Recruitment', senderName: 'NBS Investment Banking Club', senderEmail: 'ibc@example.edu.sg', receivedAt: '2026-08-15T01:30:00.000Z' })
    expect(result.extractedPayload.opportunity).toMatchObject({
      title: 'IBC Sales & Trading Recruitment', category: 'CLUB', eligibilityText: 'Freshmen eligible',
      applicationUrl: 'https://example.edu.sg/forms/ibc-recruitment'
    })
    expect(result.extractedPayload.opportunity.deadline).toBe('2026-08-18T15:59:00.000Z')
  })

  it('preserves an academic-week deadline as unresolved source text', () => {
    const result = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES.exchange })
    expect(result.extractedPayload.opportunity.deadline).toBeNull()
    expect(result.extractedPayload.opportunity.deadlineSourceText).toBe('Deadline: Week 3 of Semester 2')
  })

  it('extracts module and admin evidence without proposing an academic mutation', () => {
    const result = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES.venueChange })
    expect(result.extractedPayload.admin).toMatchObject({ moduleCode: 'AB1201', deadline: null })
    expect(result.extractedPayload.opportunity).toBeNull()
  })

  it('extracts an exact administrative deadline and explicit commitment', () => {
    const admin = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES.requiredAdmin })
    const mentorship = deterministicMailInterpretation({ rawText: NTU_MAIL_FIXTURES.mentorship })
    expect(admin.extractedPayload.admin.deadline).toBe('2026-08-20T09:00:00.000Z')
    expect(mentorship.extractedPayload.opportunity.commitment).toBe('Two hours each month')
  })

  it('keeps event classification distinct when no application or recruitment flow exists', () => {
    expect(classifyMailText(NTU_MAIL_FIXTURES.networkingEvent).category).toBe('EVENT')
  })

  it('fails malformed or undersized input safely', () => {
    expect(createMailIntakeSchema.safeParse({ rawText: 'too short' }).success).toBe(false)
    expect(createMailIntakeSchema.safeParse({ rawText: 'A valid body long enough to review.', accessToken: 'secret' }).success).toBe(false)
    expect(createMailBatchSchema.safeParse({ messages: [{ rawText: 'A valid body long enough to review.' }] }).success).toBe(true)
  })
})
