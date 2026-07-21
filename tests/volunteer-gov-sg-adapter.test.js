import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createVolunteerGovSgOpportunityAdapter,
  extractVolunteerGovSgDetail,
  extractVolunteerGovSgSearchCards,
  parseSingaporeDateTime,
} from '../server/opportunity-scanner/adapters/volunteer-gov-sg'

const root = process.cwd()
const searchHtml = readFileSync(join(root, 'tests/fixtures/volunteer-gov-sg-search.html'), 'utf8')
const detailHtml = readFileSync(join(root, 'tests/fixtures/volunteer-gov-sg-detail.html'), 'utf8')
const detailUrl = 'https://www.volunteer.gov.sg/volunteer/opportunity/details/?id=2c0f6942-102c-f111-ac83-027d80ecb760'

describe('Volunteer.gov.sg opportunity adapter', () => {
  it('parses Singapore dates and 12-hour time ranges', () => {
    expect(parseSingaporeDateTime('05/09/2026', '05:00 PM - 08:00 PM')).toBe('2026-09-05T09:00:00.000Z')
    expect(parseSingaporeDateTime('05/09/2026', '05:00 PM - 08:00 PM', true)).toBe('2026-09-05T12:00:00.000Z')
  })

  it('extracts bounded public listing cards without tokens or raw HTML', () => {
    const items = extractVolunteerGovSgSearchCards(searchHtml)
    expect(items).toHaveLength(9)
    expect(items[0]).toMatchObject({
      externalId: '652b3e3f-e084-f111-ac88-027d80ecb760',
      title: '[Woodlands] Sembawang West Playtopia',
      organisation: 'Volunteer.gov.sg',
      category: 'VOLUNTEERING',
      mode: 'IN_PERSON',
    })
    expect(items[0].location).toContain('Woodlands')
    expect(items[0].startAt).toBe('2026-09-05T09:00:00.000Z')
    expect(JSON.stringify(items)).not.toMatch(/__RequestVerificationToken|<div|<script/i)
  })

  it('extracts organiser, causes, skills, location, age and requirements from a detail page', () => {
    const item = extractVolunteerGovSgDetail(detailHtml, detailUrl)
    expect(item.title).toBe('Roadshow Ambassador')
    expect(item.organisation).toBe('Episodic Volunteering Programme')
    expect(item.description).toContain('crime prevention roadshows')
    expect(item.location).toContain('Choa Chu Kang')
    expect(item.mode).toBe('IN_PERSON')
    expect(item.eligibilityText).toContain('18 to 79')
    expect(item.requirements).toContain('successful applicants')
    expect(item.tags).toEqual(expect.arrayContaining(['Community', 'Safety & Security']))
    expect(item.startAt).toBe('2026-03-30T09:30:00.000Z')
    expect(JSON.stringify(item)).not.toMatch(/__RequestVerificationToken|<div|<script/i)
  })

  it('isolates detail failures and still returns valid listing candidates', async () => {
    const adapter = createVolunteerGovSgOpportunityAdapter({
      maxPages: 1,
      sleep: async () => {},
      createSession: async () => ({ search: async () => searchHtml }),
      fetchDetail: async () => { throw new Error('detail unavailable') },
    })

    const candidates = await adapter.fetchCandidates()
    expect(candidates).toHaveLength(9)
    expect(candidates.every(item => item.category === 'VOLUNTEERING')).toBe(true)
    expect(candidates.every(item => item.organisation === 'Volunteer.gov.sg')).toBe(true)
    expect(JSON.stringify(candidates)).not.toMatch(/__RequestVerificationToken|<div|<script/i)
  })
})
