import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  classifyNtuEvent,
  createNtuEventsOpportunityAdapter,
  extractNtuEventListing,
  parseNtuEventDates,
  parseNtuEventTimestamp,
} from '../server/opportunity-scanner/adapters/ntu-events'

const root = process.cwd()

const fixture = JSON.parse(
  readFileSync(
    join(root, 'tests/fixtures/ntu-events-page-1.json'),
    'utf8',
  ),
)

describe('NTU Events opportunity adapter', () => {
  it('parses Singapore event timestamps without changing their local time', () => {
    expect(parseNtuEventTimestamp('20260811T100000')).toBe(
      '2026-08-11T02:00:00.000Z',
    )

    expect(parseNtuEventTimestamp('2026-07-21')).toBe(
      '2026-07-20T16:00:00.000Z',
    )

    expect(parseNtuEventTimestamp('not-a-date')).toBeNull()
  })

  it('treats NTU all-day event end dates as exclusive', () => {
    const listing = fixture.items.find(
      item => item.title === 'NTU Convocation 2026',
    )

    expect(parseNtuEventDates(listing)).toEqual({
      startAt: '2026-07-20T16:00:00.000Z',
      endAt: '2026-08-01T15:59:59.999Z',
    })
  })

  it('classifies event types conservatively', () => {
    expect(
      classifyNtuEvent({
        tag: 'Conferences & Seminars',
        title: 'Financial Sustainability Public Lecture',
      }),
    ).toBe('TALK')

    expect(
      classifyNtuEvent({
        tag: 'Workshops & Classes',
        title: 'Data Analytics Workshop',
      }),
    ).toBe('WORKSHOP')

    expect(
      classifyNtuEvent({
        tag: 'Competitions',
        title: 'Business Case Competition',
      }),
    ).toBe('COMPETITION')

    expect(
      classifyNtuEvent({
        tag: 'Ceremonies',
        title: 'NTU Convocation',
      }),
    ).toBe('OTHER')
  })

  it('extracts a normalized NTU event candidate', () => {
    const listing = fixture.items.find(item =>
      item.title.includes('Financial Handbook for Sustainability'),
    )

    const candidate = extractNtuEventListing(listing)

    expect(candidate).toMatchObject({
      title:
        'NBS-PRI-ECGI Public Lecture Series on Sustainable Business: A Financial Handbook for Sustainability',
      organisation: 'Nanyang Technological University',
      category: 'TALK',
      sourceUrl: listing.url,
      deadline: null,
      startAt: '2026-08-11T02:00:00.000Z',
      endAt: '2026-08-11T03:30:00.000Z',
      location: 'Wee Chow Yaw Plaza, NBS Auditorium',
      mode: 'IN_PERSON',
    })

    expect(candidate.externalId).toContain(
      '/events/detail/2026/08/11/',
    )

    expect(candidate.tags).toEqual(
      expect.arrayContaining([
        'AI',
        'Finance',
        'Business',
        'Sustainability',
      ]),
    )
  })

  it('fetches every reported page without browser cookies', async () => {
    const fetchJson = vi.fn(async url => ({
      data: fixture,
      finalUrl: url,
    }))

    const adapter = createNtuEventsOpportunityAdapter({
      fetchJson,
      paceMs: 0,
      sleep: vi.fn(),
    })

    const candidates = await adapter.fetchCandidates()

    expect(fetchJson).toHaveBeenCalledTimes(1)

    const requestedUrl = new URL(fetchJson.mock.calls[0][0])

    expect(requestedUrl.searchParams.get('listingKeyword')).toBe('')
    expect(requestedUrl.searchParams.get('categories')).toBe('all')
    expect(requestedUrl.searchParams.get('interests')).toBe('all')
    expect(requestedUrl.searchParams.get('audiences')).toBe('all')
    expect(requestedUrl.searchParams.get('page')).toBe('1')

    expect(candidates).toHaveLength(fixture.items.length)

    expect(
      candidates.every(
        candidate =>
          candidate.sourceUrl.startsWith(
            'https://www.ntu.edu.sg/events/detail/',
          ) &&
          candidate.organisation ===
            'Nanyang Technological University',
      ),
    ).toBe(true)
  })
})
