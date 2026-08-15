import { describe, expect, it } from 'vitest'
import { splitPastedEmails } from '../server/services/mail-segmentation.js'
import { FOUR_EMAIL_PASTE, NTU_MAIL_FIXTURES, TWO_EMAIL_PASTE } from './fixtures/ntu-mail.js'

describe('pasted email segmentation', () => {
  it('keeps one email as one segment', () => {
    const result = splitPastedEmails(NTU_MAIL_FIXTURES.ccaRecruitment)
    expect(result).toMatchObject({ ambiguous: false, warning: null })
    expect(result.segments).toHaveLength(1)
  })

  it('splits two and four complete Outlook-style header blocks', () => {
    expect(splitPastedEmails(TWO_EMAIL_PASTE).segments).toHaveLength(2)
    expect(splitPastedEmails(FOUR_EMAIL_PASTE).segments).toHaveLength(4)
    expect(splitPastedEmails(FOUR_EMAIL_PASTE).segments.slice(1).every(item => item.boundaryConfidence === 'HIGH')).toBe(true)
  })

  it('does not split on blank paragraphs or a subjectless message', () => {
    expect(splitPastedEmails(NTU_MAIL_FIXTURES.subjectless).segments).toHaveLength(1)
    expect(splitPastedEmails(`Subject: One message\n\nFirst paragraph.\n\nSecond paragraph.\n\nRegards,\nOffice`).segments).toHaveLength(1)
  })

  it('recognises forwarded-message evidence', () => {
    const result = splitPastedEmails(NTU_MAIL_FIXTURES.forwarded)
    expect(result.segments).toHaveLength(2)
    expect(result.segments[1].boundarySignals).toContain('forwarded/original-message separator')
  })

  it('recognises an Outlook on-behalf-of sender line without a From label', () => {
    const pasted = `${NTU_MAIL_FIXTURES.subjectless}\n\nNTU Careers on behalf of Employer Relations <careers@ntu.edu.sg>\nSent: 15 August 2026 12:00\nTo: Students <students@e.ntu.edu.sg>\nSubject: Career event\n\nJoin the employer webinar.`
    const result = splitPastedEmails(pasted)
    expect(result.segments).toHaveLength(2)
    expect(result.segments[1].boundarySignals).toContain('on-behalf-of sender line')
  })

  it('flags weaker repeated subject evidence for explicit review', () => {
    const result = splitPastedEmails(NTU_MAIL_FIXTURES.ambiguousMultiple)
    expect(result).toMatchObject({ ambiguous: true, warning: 'Multiple emails may be present' })
    expect(result.segments).toHaveLength(2)
  })
})
