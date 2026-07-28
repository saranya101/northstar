import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import {
  OPPORTUNITY_PREFERENCE_DEFAULTS,
} from '~~/shared/schemas/opportunity-preferences'
import {
  runScheduledOpportunitySync,
} from '../opportunity-scanner/scheduled-sync'

export const OPPORTUNITY_REFRESH_COOLDOWN_MS = 15 * 60 * 1000

let activeRefresh = false

function refreshError(statusCode, statusMessage, data = {}) {
  throw createError({ statusCode, statusMessage, data })
}

async function ensurePreference(userId, database) {
  await database.opportunityRadarPreference.upsert({
    where: { userId },
    create: {
      userId,
      feedRefreshCadence:
        OPPORTUNITY_PREFERENCE_DEFAULTS.feedRefreshCadence,
      closingSoonDays:
        OPPORTUNITY_PREFERENCE_DEFAULTS.closingSoonDays,
      defaultSort:
        OPPORTUNITY_PREFERENCE_DEFAULTS.defaultSort,
      hideExpired:
        OPPORTUNITY_PREFERENCE_DEFAULTS.hideExpired,
      includeOther:
        OPPORTUNITY_PREFERENCE_DEFAULTS.includeOther,
    },
    update: {},
  })
}

export async function refreshOpportunitiesForUser(
  userId,
  options = {},
) {
  const database = options.database || prisma
  const sync = options.sync || runScheduledOpportunitySync
  const now = options.now || new Date()

  if (activeRefresh) {
    refreshError(
      409,
      'An opportunity refresh is already running. Please try again shortly.',
    )
  }

  activeRefresh = true

  try {
    await ensurePreference(userId, database)

    const cutoff = new Date(
      now.getTime() - OPPORTUNITY_REFRESH_COOLDOWN_MS,
    )
    const claim =
      await database.opportunityRadarPreference.updateMany({
        where: {
          userId,
          OR: [
            { lastManualRefreshAt: null },
            { lastManualRefreshAt: { lte: cutoff } },
          ],
        },
        data: {
          lastManualRefreshAt: now,
        },
      })

    if (claim.count !== 1) {
      const current =
        await database.opportunityRadarPreference.findUnique({
          where: { userId },
          select: { lastManualRefreshAt: true },
        })
      const nextAllowedAt = new Date(
        current.lastManualRefreshAt.getTime()
          + OPPORTUNITY_REFRESH_COOLDOWN_MS,
      ).toISOString()

      refreshError(
        429,
        'Opportunity refresh is cooling down.',
        { nextAllowedAt },
      )
    }

    const summary = await sync()
    return {
      ...summary,
      lastManualRefreshAt: now.toISOString(),
      nextAllowedAt: new Date(
        now.getTime() + OPPORTUNITY_REFRESH_COOLDOWN_MS,
      ).toISOString(),
    }
  } catch (error) {
    if (error?.statusCode) throw error
    refreshError(
      500,
      'Unable to refresh opportunities right now.',
    )
  } finally {
    activeRefresh = false
  }
}

export function resetOpportunityRefreshLockForTests() {
  activeRefresh = false
}
