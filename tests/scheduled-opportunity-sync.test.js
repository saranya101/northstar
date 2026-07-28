import { readFile } from 'node:fs/promises'

import {
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  SCHEDULED_OPPORTUNITY_SOURCES,
  runScheduledOpportunitySync
} from '../server/opportunity-scanner/scheduled-sync'

import {
  isAuthorizedCronRequest
} from '../server/utils/cron-auth'

const successfulRun = overrides => ({
  fetchedCount: 5,
  createdCount: 2,
  updatedCount: 1,
  duplicateCount: 1,
  invalidCount: 0,
  closedCount: 1,
  ...overrides
})

describe('scheduled opportunity sync', () => {
  it('uses every successfully implemented production opportunity source', () => {
    expect(SCHEDULED_OPPORTUNITY_SOURCES).toEqual([
      'devpost',
      'volunteer-gov-sg',
      'ntu-events',
      'hackerearth',
      'nus-events'
    ])
  })

  it('runs sources sequentially and aggregates their counts', async () => {
    const calls = []

    const sync = vi.fn(async source => {
      calls.push(source)
      return successfulRun()
    })

    const dates = [
      new Date('2026-07-21T00:00:00.000Z'),
      new Date('2026-07-21T00:01:00.000Z')
    ]

    const result = await runScheduledOpportunitySync({
      sync,
      clock: () => dates.shift()
    })

    expect(calls).toEqual([
      'devpost',
      'volunteer-gov-sg',
      'ntu-events',
      'hackerearth',
      'nus-events'
    ])

    expect(result.success).toBe(true)
    expect(result.succeededCount).toBe(5)
    expect(result.failedCount).toBe(0)

    expect(result.totals).toEqual({
      fetchedCount: 25,
      createdCount: 10,
      updatedCount: 5,
      duplicateCount: 5,
      invalidCount: 0,
      closedCount: 5
    })
  })

  it('continues running later sources when one source fails', async () => {
    const calls = []

    const sync = vi.fn(async source => {
      calls.push(source)

      if (source === 'volunteer-gov-sg') {
        throw new Error('Private implementation detail')
      }

      return successfulRun()
    })

    const result = await runScheduledOpportunitySync({
      sync,
      clock: () => new Date('2026-07-21T00:00:00.000Z')
    })

    expect(calls).toEqual([
      'devpost',
      'volunteer-gov-sg',
      'ntu-events',
      'hackerearth',
      'nus-events'
    ])

    expect(result.success).toBe(false)
    expect(result.succeededCount).toBe(4)
    expect(result.failedCount).toBe(1)

    expect(result.results[1]).toMatchObject({
      source: 'volunteer-gov-sg',
      status: 'FAILED',
      safeErrorMessage:
        'The opportunity source could not be synced.'
    })

    expect(JSON.stringify(result)).not.toContain(
      'Private implementation detail'
    )
  })
})

describe('cron authentication', () => {
  it('accepts only the exact bearer secret', () => {
    expect(
      isAuthorizedCronRequest(
        'Bearer secure-test-secret',
        'secure-test-secret'
      )
    ).toBe(true)

    expect(
      isAuthorizedCronRequest(
        'Bearer wrong-secret',
        'secure-test-secret'
      )
    ).toBe(false)

    expect(
      isAuthorizedCronRequest(undefined, 'secure-test-secret')
    ).toBe(false)

    expect(
      isAuthorizedCronRequest('Bearer secure-test-secret', undefined)
    ).toBe(false)
  })
})

describe('Vercel cron configuration', () => {
  it('targets the protected opportunity cron endpoint daily', async () => {
    const config = JSON.parse(
      await readFile(
        new URL('../vercel.json', import.meta.url),
        'utf8'
      )
    )

    expect(config.crons).toEqual([
      {
        path: '/api/cron/opportunities',
        schedule: '0 0 * * *'
      }
    ])
  })
})
