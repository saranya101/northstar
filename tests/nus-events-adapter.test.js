import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  createNusEventsOpportunityAdapter,
  NUS_COMPUTING_CALENDAR_URL,
  parseNusCalendar,
} from '../server/opportunity-scanner/adapters/nus-events'

const calendar = readFileSync(
  join(process.cwd(), 'tests/fixtures/nus-computing-events.ics'),
  'utf8',
)

describe('NUS Events opportunity adapter', () => {
  it('parses Singapore calendar dates and isolates malformed events', () => {
    const candidates = parseNusCalendar(calendar, {
      now: new Date('2027-08-01T00:00:00Z'),
    })
    expect(candidates).toHaveLength(3)
    expect(candidates[0]).toMatchObject({
      externalId: 'nus-soc-30001',
      title: 'Trustworthy AI Research Workshop',
      organisation: 'NUS School of Computing',
      category: 'WORKSHOP',
      startAt: '2027-10-05T06:00:00.000Z',
      endAt: '2027-10-05T08:00:00.000Z',
      location: 'COM3 Seminar Room',
      mode: 'IN_PERSON',
      deadline: null,
    })
    expect(candidates[0].tags).toEqual(
      expect.arrayContaining(['AI', 'Research']),
    )
    expect(candidates[1]).toMatchObject({
      category: 'COMPETITION',
      mode: 'ONLINE',
      location: null,
    })
    expect(candidates[2]).toEqual({})
  })

  it('filters expired calendar events without inventing deadlines', () => {
    expect(
      parseNusCalendar(calendar, {
        now: new Date('2028-01-01T00:00:00Z'),
      }),
    ).toEqual([{}])
  })

  it('fetches only the bounded official public calendar', async () => {
    const fetchCalendar = vi.fn(async url => ({
      text: calendar,
      finalUrl: url,
    }))
    const adapter = createNusEventsOpportunityAdapter({
      fetchCalendar,
      now: () => new Date('2027-08-01T00:00:00Z'),
    })
    const candidates = await adapter.fetchCandidates()
    expect(fetchCalendar).toHaveBeenCalledOnce()
    expect(fetchCalendar).toHaveBeenCalledWith(NUS_COMPUTING_CALENDAR_URL)
    expect(candidates).toHaveLength(3)
    expect(JSON.stringify(candidates)).not.toContain('BEGIN:VCALENDAR')
  })

  it('rejects invalid calendar data', () => {
    expect(() => parseNusCalendar('<html>not a calendar</html>')).toThrow(
      'Invalid NUS calendar response.',
    )
  })
})
