import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  createHackerEarthOpportunityAdapter,
  extractHackerEarthDetail,
  extractHackerEarthListingLinks,
  HACKEREARTH_LISTINGS_URL,
} from '../server/opportunity-scanner/adapters/hackerearth'

const fixture = name =>
  readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8')

describe('HackerEarth opportunity adapter', () => {
  it('extracts unique canonical challenge links from server-rendered HTML', () => {
    expect(
      extractHackerEarthListingLinks(fixture('hackerearth-listings.html')),
    ).toEqual([
      {
        sourceUrl:
          'https://www.hackerearth.com/challenges/hackathon/green-ai-buildathon/',
        title: 'Green AI Buildathon',
      },
      {
        sourceUrl:
          'https://www.hackerearth.com/challenges/competitive/cloud-code-challenge/',
        title: 'Cloud Code Challenge',
      },
    ])
  })

  it('extracts detail dates, mode, rules, prizes and normalized tags', () => {
    const candidate = extractHackerEarthDetail(
      fixture('hackerearth-detail.html'),
      'https://www.hackerearth.com/challenges/hackathon/green-ai-buildathon/',
    )
    expect(candidate).toMatchObject({
      externalId: 'green-ai-buildathon',
      title: 'Green AI Buildathon',
      organisation: 'HackerEarth Labs',
      category: 'HACKATHON',
      deadline: '2027-09-30T23:59:00.000Z',
      startAt: '2027-09-01T09:00:00.000Z',
      endAt: '2027-09-30T23:59:00.000Z',
      mode: 'ONLINE',
      location: null,
    })
    expect(candidate.requirements).toContain('working software')
    expect(candidate.benefits).toContain('USD 10,000')
    expect(candidate.tags).toEqual(
      expect.arrayContaining(['AI', 'Cloud', 'Sustainability']),
    )
    expect(JSON.stringify(candidate)).not.toMatch(/<[^>]+>/)
  })

  it('isolates malformed detail pages instead of failing the source', async () => {
    const fetchHtml = vi.fn(async url => {
      if (url === HACKEREARTH_LISTINGS_URL) {
        return { html: fixture('hackerearth-listings.html'), finalUrl: url }
      }
      if (url.includes('green-ai')) {
        return { html: fixture('hackerearth-detail.html'), finalUrl: url }
      }
      return { html: '<html><body>changed markup</body></html>', finalUrl: url }
    })
    const adapter = createHackerEarthOpportunityAdapter({
      fetchHtml,
      paceMs: 0,
      sleep: vi.fn(),
    })
    const candidates = await adapter.fetchCandidates()
    expect(candidates).toHaveLength(2)
    expect(candidates[0].externalId).toBe('green-ai-buildathon')
    expect(candidates[1]).toEqual({})
  })

  it('rejects an unusable source response safely', async () => {
    const adapter = createHackerEarthOpportunityAdapter({
      fetchHtml: vi.fn(async () => {
        throw new Error('network response body must stay private')
      }),
    })
    await expect(adapter.fetchCandidates()).rejects.toThrow(
      'network response body must stay private',
    )
  })
})
