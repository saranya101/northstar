import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma.js', () => ({ prisma: {} }))
import {
  refreshOpportunitiesForUser,
  resetOpportunityRefreshLockForTests,
} from '../server/services/opportunity-refresh.js'

const NOW = new Date('2026-07-28T08:00:00.000Z')

function database(overrides = {}) {
  return {
    opportunityRadarPreference: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        lastManualRefreshAt: new Date('2026-07-28T07:55:00.000Z'),
      }),
      ...overrides,
    },
  }
}

describe('manual opportunity refresh', () => {
  it('returns successful and partial per-source summaries safely', async () => {
    resetOpportunityRefreshLockForTests()
    const sync = vi.fn().mockResolvedValue({
      success: false,
      results: [
        { source: 'devpost', status: 'SUCCEEDED' },
        { source: 'ntu-events', status: 'FAILED', safeErrorMessage: 'Source refresh failed.' },
      ],
      totals: { createdCount: 2, invalidCount: 1 },
    })

    const result = await refreshOpportunitiesForUser('user-a', {
      database: database(),
      sync,
      now: NOW,
    })

    expect(result.results).toHaveLength(2)
    expect(result.nextAllowedAt).toBe('2026-07-28T08:15:00.000Z')
  })

  it('enforces the atomic cooldown and returns the next time', async () => {
    resetOpportunityRefreshLockForTests()
    const db = database({
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    })

    await expect(refreshOpportunitiesForUser('user-a', {
      database: db,
      now: NOW,
    })).rejects.toMatchObject({
      statusCode: 429,
      data: { nextAllowedAt: '2026-07-28T08:10:00.000Z' },
    })
  })

  it('prevents a second in-process refresh and hides source errors', async () => {
    resetOpportunityRefreshLockForTests()
    let release
    const pending = new Promise(resolve => { release = resolve })
    const first = refreshOpportunitiesForUser('user-a', {
      database: database(),
      sync: () => pending,
      now: NOW,
    })
    await Promise.resolve()
    await Promise.resolve()

    await expect(refreshOpportunitiesForUser('user-b', {
      database: database(),
      now: NOW,
    })).rejects.toMatchObject({ statusCode: 409 })

    release({ success: true, results: [], totals: {} })
    await first

    await expect(refreshOpportunitiesForUser('user-c', {
      database: database(),
      sync: () => Promise.reject(new Error('secret database-url stack')),
      now: NOW,
    })).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Unable to refresh opportunities right now.',
    })
  })
})
