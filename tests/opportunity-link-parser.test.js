import { describe, expect, it } from 'vitest'
import { extractOpportunityFromHtml } from '../server/services/opportunity-link-parser'

describe('deterministic opportunity webpage extraction', () => {
  it('prioritises JSON-LD opportunity fields', () => {
    const html = `<html><head><title>Fallback title</title><meta property="og:title" content="Metadata title"><link rel="canonical" href="https://example.org/jobs/intern#details"><script type="application/ld+json">{"@type":"JobPosting","title":"Engineering Internship","description":"Build useful systems","hiringOrganization":{"name":"Example Labs"},"validThrough":"2026-08-12T23:59:00+08:00","jobLocation":{"name":"Singapore"},"jobLocationType":"TELECOMMUTE","url":"https://example.org/apply#form","qualifications":"Current students","skills":"JavaScript","jobBenefits":"Mentorship","keywords":"engineering, internship"}</script></head><body><h1>Page heading</h1></body></html>`
    const result = extractOpportunityFromHtml(html, 'https://example.org/jobs/intern')
    expect(result.candidate.title).toMatchObject({ value: 'Engineering Internship', confidence: .98 })
    expect(result.candidate.organisation.value).toBe('Example Labs')
    expect(result.candidate.deadline.value).toBe('2026-08-12T15:59:00.000Z')
    expect(result.candidate.applicationUrl.value).toBe('https://example.org/apply')
    expect(result.candidate.sourceUrl.value).toBe('https://example.org/jobs/intern')
    expect(result.candidate.eligibilityText.value).toBe('Current students')
  })

  it('uses Open Graph and standard metadata when JSON-LD is absent', () => {
    const html = `<html><head><meta property="og:title" content="Civic Hackathon"><meta property="og:description" content="Build for the community"><meta property="og:site_name" content="Civic Lab"><meta name="keywords" content="hackathon, students"></head><body><h1>Different heading</h1></body></html>`
    const result = extractOpportunityFromHtml(html, 'https://events.example.org/hackathon')
    expect(result.candidate.title).toMatchObject({ value: 'Civic Hackathon', confidence: .86 })
    expect(result.candidate.organisation.value).toBe('Civic Lab')
    expect(result.candidate.description.value).toBe('Build for the community')
    expect(result.candidate.category.value).toBe('HACKATHON')
  })

  it('extracts labelled deadlines and leaves ambiguous yearless dates null', () => {
    const clear = extractOpportunityFromHtml('<html><body><h1>Student Hackathon</h1><p>Deadline: 12 August 2026, 11:59 PM</p></body></html>', 'https://example.org/event')
    expect(clear.candidate.deadline.value).toBe('2026-08-12T15:59:00.000Z')
    const ambiguous = extractOpportunityFromHtml('<html><body><h1>Student Hackathon</h1><p>Applications close 12 August</p></body></html>', 'https://example.org/event')
    expect(ambiguous.candidate.deadline.value).toBeNull()
    expect(ambiguous.candidate.deadline.warnings.join(' ')).toMatch(/without a safe year/)
  })

  it('resolves and normalises canonical and application URLs', () => {
    const html = `<html><head><link rel="canonical" href="/events/build#about"></head><body><h1>Build Challenge</h1><a href="/apply#start">Apply now</a></body></html>`
    const result = extractOpportunityFromHtml(html, 'https://EXAMPLE.org/events/source?ref=mail#top')
    expect(result.sourceHost).toBe('example.org')
    expect(result.candidate.sourceUrl.value).toBe('https://example.org/events/build')
    expect(result.candidate.applicationUrl.value).toBe('https://example.org/apply')
  })
})
