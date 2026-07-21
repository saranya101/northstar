import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractOpportunityFromHtml } from '../server/services/opportunity-link-parser'

const singaporeDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

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

  it('extracts the Garena challenge timeline, FAQ, benefits and scoped final location', () => {
    const html = readFileSync(new URL('./fixtures/garena-ai-build-challenge.html', import.meta.url), 'utf8')
    const result = extractOpportunityFromHtml(html, 'https://aibuildchallenge.garena.sg/#challenge')
    const persisted = JSON.stringify(result)

    expect(singaporeDate(result.candidate.deadline.value)).toBe('2026-07-23')
    expect(singaporeDate(result.candidate.endAt.value)).toBe('2026-08-23')
    expect(result.candidate.deadline.confidence).toBeGreaterThanOrEqual(.9)
    expect(result.candidate.deadline.warnings.join(' ')).toMatch(/no closing time/i)
    expect(result.candidate.eligibilityText).toMatchObject({ confidence: .95 })
    expect(result.candidate.eligibilityText.value).toMatch(/university.*working professionals/i)
    expect(result.candidate.eligibilityText.value).toMatch(/prior AI experience is not required/i)
    expect(result.candidate.requirements.value).toMatch(/3 to 5 members/i)
    expect(result.candidate.requirements.value).toMatch(/Each member must submit an individual application/i)
    expect(result.candidate.requirements.value).toMatch(/onsite at Garena Singapore's office/i)
    expect(result.candidate.benefits.value).toMatch(/Cash prizes/i)
    expect(result.candidate.benefits.value).toMatch(/OpenAI API credits/i)
    expect(result.candidate.benefits.value).toMatch(/ChatGPT Pro access/i)
    expect(result.candidate.benefits.value).toMatch(/Mentorship|Networking/i)
    expect(result.candidate.benefits.value).toMatch(/career opportunities/i)
    expect(result.candidate.location.value).toBe('Singapore; onsite final at Garena Singapore office')
    expect(result.candidate.mode.value).toBe('UNKNOWN')
    expect(singaporeDate(result.candidate.deadline.value)).not.toBe(singaporeDate(result.candidate.endAt.value))
    expect(result.warnings.join(' ')).toMatch(/PROPOSAL SUBMISSION: By 9 Aug 2026.*separate from the application deadline/i)
    expect(persisted).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    expect(persisted).not.toMatch(/<\/?(?:html|section|div|span)\b/i)
  })
})
