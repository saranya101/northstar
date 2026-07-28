import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import {
  normalizeOpportunityPreferences,
  opportunityPreferencesInputSchema,
} from '~~/shared/schemas/opportunity-preferences'
import {
  listOpportunityAdapterKeys,
  listOpportunityAdapters,
} from '../opportunity-scanner/adapters/registry'

const PUBLIC_ADAPTER_KEYS = () =>
  listOpportunityAdapterKeys().filter(key => key !== 'mock')

export function getAvailableOpportunitySourceKeys() {
  return PUBLIC_ADAPTER_KEYS()
}

export function getAvailableOpportunitySources() {
  return listOpportunityAdapters().map(adapter => ({
    key: adapter.key,
    name: adapter.name,
  }))
}

export function validateOpportunityPreferences(input) {
  const result = opportunityPreferencesInputSchema.safeParse(input)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please correct the highlighted fields.',
      data: {
        fieldErrors: Object.fromEntries(
          result.error.issues.map(issue => [
            issue.path.at(-1) || '_form',
            issue.message,
          ]),
        ),
      },
    })
  }

  const knownSources = new Set(PUBLIC_ADAPTER_KEYS())
  const unknownSource = result.data.preferredSources.find(
    key => !knownSources.has(key),
  )

  if (unknownSource) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please correct the highlighted fields.',
      data: {
        fieldErrors: {
          preferredSources: `Unknown opportunity source: ${unknownSource}.`,
        },
      },
    })
  }

  return result.data
}

export async function getOpportunityPreferencesForUser(
  userId,
  database = prisma,
) {
  if (!database.opportunityRadarPreference?.findUnique) {
    return normalizeOpportunityPreferences(null)
  }

  const record = await database.opportunityRadarPreference.findUnique({
    where: { userId },
  })

  return normalizeOpportunityPreferences(record)
}

export async function saveOpportunityPreferencesForUser(
  userId,
  input,
  database = prisma,
) {
  const data = validateOpportunityPreferences(input)
  const record = await database.opportunityRadarPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })

  return normalizeOpportunityPreferences(record)
}
