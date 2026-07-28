import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  classifyNtuEvent,
  createNtuEventsOpportunityAdapter,
  deduplicateNtuCandidates,
  extractNtuEventListing,
  extractNtuOfficialPage,
  extractNtuSearchResultUrls,
  aggregateNtuSubSources,
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
      officialPages: [],
      searchQueries: [],
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

  it('extracts school competitions and keeps deadlines separate from event dates', () => {
    const html = readFileSync(
      join(root, 'tests/fixtures/ntu-official-event.html'),
      'utf8',
    )
    const candidate = extractNtuOfficialPage(
      html,
      {
        key: 'ntu-engineering-challenge',
        url: 'https://www.ntu.edu.sg/engineering/challenge-2027',
        organisation: 'College of Engineering',
      },
      { now: new Date('2027-08-01T00:00:00Z') },
    )

    expect(candidate).toMatchObject({
      externalId: 'ntu-engineering-challenge',
      title: 'NTU Engineering Innovation Challenge 2027',
      organisation: 'College of Engineering',
      category: 'COMPETITION',
      deadline: '2027-09-10T15:59:00.000Z',
      startAt: '2027-09-20T01:00:00.000Z',
      endAt: '2027-09-21T09:00:00.000Z',
      location: 'NTU Innovation Centre',
      mode: 'IN_PERSON',
    })
    expect(candidate.applicationUrl).toBe(
      'https://www.ntu.edu.sg/engineering-challenge/apply',
    )
    expect(JSON.stringify(candidate)).not.toContain('<html')
  })

  it('extracts an entrepreneurship programme with a local application deadline', () => {
    const html = readFileSync(
      join(root, 'tests/fixtures/ntu-official-programme.html'),
      'utf8',
    )
    const candidate = extractNtuOfficialPage(
      html,
      {
        key: 'ntu-oep',
        url: 'https://www.ntu.edu.sg/ntupreneur/programmes/oep',
        organisation: 'NTU Entrepreneurship Academy',
      },
      { now: new Date('2027-07-01T00:00:00Z') },
    )

    expect(candidate).toMatchObject({
      title: 'Overseas Entrepreneurship Programme',
      category: 'ENTREPRENEURSHIP',
      deadline: '2027-08-21T15:59:59.000Z',
      commitment: 'Six-month overseas internship',
      eligibilityText: 'Current NTU undergraduates',
    })
  })

  it('deduplicates central and school copies while preserving complementary fields', () => {
    const base = extractNtuEventListing(fixture.items[0])
    const school = {
      ...base,
      description: 'A fuller school description.',
      benefits: 'Certificate of participation',
      tags: [...base.tags, 'Leadership'],
    }
    const result = deduplicateNtuCandidates([base, school])
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('A fuller school description.')
    expect(result[0].benefits).toBe('Certificate of participation')
  })

  it('continues after one broken sub-source and fails only when all are unusable', async () => {
    const partial = await aggregateNtuSubSources([
      { key: 'broken', fetch: async () => { throw new Error('changed') } },
      { key: 'empty', fetch: async () => [] },
    ])
    expect(partial.diagnostics).toEqual([
      { key: 'broken', status: 'FAILED', count: 0 },
      { key: 'empty', status: 'SUCCEEDED', count: 0 },
    ])

    await expect(aggregateNtuSubSources([
      { key: 'broken-a', fetch: async () => { throw new Error('timeout') } },
      { key: 'broken-b', fetch: async () => { throw new Error('markup') } },
    ])).rejects.toThrow('All NTU public sub-sources were unavailable.')
  })

  it('bounds official search discovery and excludes expired, unsafe and non-actionable results', () => {
    const results = extractNtuSearchResultUrls({
      totalPages: 8,
      totalItems: 80,
      items: [
        {
          title: 'Current CCDS Hackathon',
          description: 'A student coding challenge',
          url: 'https://www.ntu.edu.sg/computing/news-events/events/detail/2027/09/20/default-calendar/current-hackathon',
        },
        {
          title: 'Current NBS Competition',
          description: 'A student case competition',
          url: 'https://www.ntu.edu.sg/business/current-competition',
        },
        {
          title: 'Third bounded result',
          description: 'A student workshop',
          url: 'https://www.ntu.edu.sg/eee/third-result',
        },
        {
          title: 'Fourth result beyond the bound',
          description: 'A student research programme',
          url: 'https://www.ntu.edu.sg/mse/fourth-result',
        },
        {
          title: 'Expired hackathon',
          url: 'https://www.ntu.edu.sg/computing/events/detail/2026/01/01/old',
        },
        {
          title: 'Annual report',
          url: 'https://www.ntu.edu.sg/reports/annual-report',
        },
        {
          title: 'External challenge',
          url: 'https://example.com/challenge',
        },
      ],
    }, { now: new Date('2027-08-01T00:00:00Z') })

    expect(results).toEqual([
      {
        url: 'https://www.ntu.edu.sg/computing/news-events/events/detail/2027/09/20/default-calendar/current-hackathon',
        organisation: 'College of Computing and Data Science',
        discovered: true,
      },
      {
        url: 'https://www.ntu.edu.sg/business/current-competition',
        organisation: 'Nanyang Business School',
        discovered: true,
      },
      {
        url: 'https://www.ntu.edu.sg/eee/third-result',
        organisation: 'School of Electrical and Electronic Engineering',
        discovered: true,
      },
    ])
  })

  it('rejects undated discovered pages without an open participation signal', () => {
    expect(extractNtuOfficialPage(
      '<html><head><meta property="og:title" content="Education"></head><body><p>Read about our workshops and research.</p></body></html>',
      {
        url: 'https://www.ntu.edu.sg/medicine/education',
        organisation: 'Lee Kong Chian School of Medicine',
        discovered: true,
      },
      { now: new Date('2027-08-01T00:00:00Z') },
    )).toBeNull()
  })
})
