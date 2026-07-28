import { z } from 'zod'
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_MODES,
} from './opportunities.js'

export const OPPORTUNITY_FEED_CADENCES = Object.freeze([
  'MANUAL',
  'HOURLY',
  'EVERY_6_HOURS',
  'EVERY_12_HOURS',
  'DAILY',
])

export const OPPORTUNITY_DEFAULT_SORTS = Object.freeze([
  'RECOMMENDED',
  'NEWEST',
  'DEADLINE',
  'PORTFOLIO_VALUE',
])

export const OPPORTUNITY_PORTFOLIO_GOALS = Object.freeze([
  'LEADERSHIP',
  'TECHNICAL_SKILLS',
  'COMMUNITY_IMPACT',
  'BUSINESS_EXPERIENCE',
  'RESEARCH_EXPERIENCE',
  'ENTREPRENEURSHIP',
  'SCHOLARSHIP_EVIDENCE',
  'TRANSFER_APPLICATION_EVIDENCE',
  'NETWORKING',
  'RESUME_BUILDING',
])

export const OPPORTUNITY_CLOSING_SOON_DAYS = Object.freeze([
  3,
  7,
  14,
  30,
])

export const OPPORTUNITY_PREFERENCE_DEFAULTS = Object.freeze({
  feedRefreshCadence: 'EVERY_6_HOURS',
  preferredSources: [],
  preferredCategories: [],
  preferredModes: [],
  closingSoonDays: 7,
  defaultSort: 'RECOMMENDED',
  hideExpired: true,
  includeOther: true,
  portfolioGoals: [],
  skillGoals: [],
  lastManualRefreshAt: null,
})

const uniqueStrings = values => {
  const seen = new Set()
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => {
      const key = value.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const uniqueEnums = values => [...new Set(values)]

const sourceKeySchema = z.string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a valid source key.')

const skillSchema = z.string()
  .trim()
  .min(1)
  .max(80)

export const opportunityPreferencesInputSchema = z.strictObject({
  feedRefreshCadence: z.enum(OPPORTUNITY_FEED_CADENCES),
  preferredSources: z.array(sourceKeySchema).max(50).transform(uniqueStrings),
  preferredCategories: z.array(z.enum(OPPORTUNITY_CATEGORIES)).max(OPPORTUNITY_CATEGORIES.length).transform(uniqueEnums),
  preferredModes: z.array(z.enum(OPPORTUNITY_MODES)).max(OPPORTUNITY_MODES.length).transform(uniqueEnums),
  closingSoonDays: z.union(OPPORTUNITY_CLOSING_SOON_DAYS.map(value => z.literal(value))),
  defaultSort: z.enum(OPPORTUNITY_DEFAULT_SORTS),
  hideExpired: z.boolean(),
  includeOther: z.boolean(),
  portfolioGoals: z.array(z.enum(OPPORTUNITY_PORTFOLIO_GOALS)).max(OPPORTUNITY_PORTFOLIO_GOALS.length).transform(uniqueEnums),
  skillGoals: z.array(skillSchema).max(30).transform(uniqueStrings),
})

export function normalizeOpportunityPreferences(record) {
  return {
    feedRefreshCadence: record?.feedRefreshCadence
      || OPPORTUNITY_PREFERENCE_DEFAULTS.feedRefreshCadence,
    preferredSources: uniqueStrings(record?.preferredSources || []),
    preferredCategories: uniqueEnums(record?.preferredCategories || []),
    preferredModes: uniqueEnums(record?.preferredModes || []),
    closingSoonDays: record?.closingSoonDays
      || OPPORTUNITY_PREFERENCE_DEFAULTS.closingSoonDays,
    defaultSort: record?.defaultSort
      || OPPORTUNITY_PREFERENCE_DEFAULTS.defaultSort,
    hideExpired: record?.hideExpired
      ?? OPPORTUNITY_PREFERENCE_DEFAULTS.hideExpired,
    includeOther: record?.includeOther
      ?? OPPORTUNITY_PREFERENCE_DEFAULTS.includeOther,
    portfolioGoals: uniqueEnums(record?.portfolioGoals || []),
    skillGoals: uniqueStrings(record?.skillGoals || []),
    lastManualRefreshAt: record?.lastManualRefreshAt
      ? new Date(record.lastManualRefreshAt).toISOString()
      : null,
  }
}
