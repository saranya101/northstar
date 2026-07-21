import { describe, expect, it } from 'vitest'
import { extractOpportunityFromText } from '../server/services/opportunity-text-parser'

describe('deterministic opportunity text extraction', () => {
  it('extracts a labeled date and application URL', () => {
    const result = extractOpportunityFromText(`NTU Build for Good Hackathon\nOrganised by Example Labs\nDeadline: 12 August 2026, 11:59 PM\nApply: https://forms.example.com/apply\nLocation: The Arc`)
    expect(result.candidate.category.value).toBe('HACKATHON')
    expect(result.candidate.deadline.value).toBe('2026-08-12T15:59:00.000Z')
    expect(result.candidate.applicationUrl.value).toBe('https://forms.example.com/apply')
    expect(result.candidate.location.value).toBe('The Arc')
  })

  it('supports numeric and ISO date formats', () => {
    expect(extractOpportunityFromText('Research programme\nOrganisation: Lab One\nDeadline: 12/08/2026').candidate.deadline.value).toBe('2026-08-11T16:00:00.000Z')
    expect(extractOpportunityFromText('Research programme\nOrganisation: Lab One\nDeadline: 2026-08-12').candidate.deadline.value).toBe('2026-08-11T16:00:00.000Z')
  })

  it('keeps uncertain yearless dates and organisations null', () => {
    const result = extractOpportunityFromText('Hackathon applications are open now\nApplications close 12 August\nJoin students to build useful tools.')
    expect(result.candidate.deadline.value).toBeNull()
    expect(result.candidate.deadline.warnings[0]).toMatch(/without a safe year/)
    expect(result.candidate.organisation.value).toBeNull()
  })

  it('never returns or persists the original pasted text', () => {
    const original = 'Secret pasted newsletter\nOrganisation: Example\nDeadline: 2026-08-12'
    const result = extractOpportunityFromText(original)
    expect(result).not.toHaveProperty('text')
    expect(JSON.stringify(result)).not.toContain(original)
  })
})
