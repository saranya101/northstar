import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma.js', () => ({ prisma: {} }))
import {
  getOpportunityPreferencesForUser,
  saveOpportunityPreferencesForUser,
  validateOpportunityPreferences,
} from '../server/services/opportunity-preferences.js'

const completeInput = overrides => ({
  feedRefreshCadence: 'HOURLY',
  preferredSources: [],
  preferredCategories: [],
  preferredModes: [],
  closingSoonDays: 7,
  defaultSort: 'RECOMMENDED',
  hideExpired: true,
  includeOther: true,
  portfolioGoals: [],
  skillGoals: [],
  ...overrides,
})

describe('Opportunity Radar preferences', () => {
  it('returns complete defaults without a saved record', async () => {
    const database = {
      opportunityRadarPreference: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }

    const result = await getOpportunityPreferencesForUser(
      'user-a',
      database,
    )
    expect(result)
      .toMatchObject({
        feedRefreshCadence: 'EVERY_6_HOURS',
        preferredSources: [],
        closingSoonDays: 7,
        defaultSort: 'RECOMMENDED',
        lastManualRefreshAt: null,
      })
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('userId')
  })

  it('deduplicates arrays and treats an empty source array as all', () => {
    expect(validateOpportunityPreferences(completeInput({
      preferredSources: [],
      preferredCategories: ['HACKATHON', 'HACKATHON'],
      skillGoals: ['JavaScript', 'JavaScript', ' Research '],
    }))).toMatchObject({
      preferredSources: [],
      preferredCategories: ['HACKATHON'],
      skillGoals: ['JavaScript', 'Research'],
    })
  })

  it('rejects unknown sources and invalid enums', () => {
    expect(() => validateOpportunityPreferences(completeInput({
      preferredSources: ['unknown-source'],
    }))).toThrow(/highlighted fields/i)

    expect(() => validateOpportunityPreferences(completeInput({
      defaultSort: 'RANDOM',
    }))).toThrow(/highlighted fields/i)
  })

  it('saves and reloads using only the authenticated user id', async () => {
    const record = {
      userId: 'user-a',
      ...completeInput({ preferredSources: ['devpost'] }),
    }
    const database = {
      opportunityRadarPreference: {
        upsert: vi.fn().mockResolvedValue(record),
        findUnique: vi.fn().mockResolvedValue(record),
      },
    }

    await saveOpportunityPreferencesForUser(
      'user-a',
      completeInput({ preferredSources: ['devpost'] }),
      database,
    )
    await getOpportunityPreferencesForUser('user-a', database)

    expect(database.opportunityRadarPreference.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'user-a' },
      }))
    expect(database.opportunityRadarPreference.findUnique)
      .toHaveBeenCalledWith({ where: { userId: 'user-a' } })
  })
})
