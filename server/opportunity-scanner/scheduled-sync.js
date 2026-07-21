import {
  OpportunitySyncError,
  SAFE_SYNC_ERROR_MESSAGE,
  runOpportunitySync
} from './sync-service'

export const SCHEDULED_OPPORTUNITY_SOURCES = Object.freeze([
  'devpost',
  'volunteer-gov-sg',
  'ntu-events'
])

const emptyCounts = () => ({
  fetchedCount: 0,
  createdCount: 0,
  updatedCount: 0,
  duplicateCount: 0,
  invalidCount: 0,
  closedCount: 0
})

const numberOrZero = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const countsFromRun = run => ({
  fetchedCount: numberOrZero(run?.fetchedCount),
  createdCount: numberOrZero(run?.createdCount),
  updatedCount: numberOrZero(run?.updatedCount),
  duplicateCount: numberOrZero(run?.duplicateCount),
  invalidCount: numberOrZero(run?.invalidCount),
  closedCount: numberOrZero(run?.closedCount)
})

const addCounts = (total, counts) => {
  for (const key of Object.keys(total)) {
    total[key] += counts[key]
  }

  return total
}

export async function runScheduledOpportunitySync(options = {}) {
  const sync = options.sync || runOpportunitySync
  const sources = options.sources || SCHEDULED_OPPORTUNITY_SOURCES
  const clock = options.clock || (() => new Date())

  const startedAt = clock()
  const results = []

  // Run sequentially to avoid unnecessary database and source-site load.
  // A failure from one source must not prevent later sources from running.
  for (const source of sources) {
    try {
      const run = await sync(source)

      results.push({
        source,
        status: 'SUCCEEDED',
        ...countsFromRun(run)
      })
    } catch (cause) {
      results.push({
        source,
        status: 'FAILED',
        safeErrorMessage:
          cause instanceof OpportunitySyncError
            ? cause.safeMessage
            : SAFE_SYNC_ERROR_MESSAGE,
        ...emptyCounts()
      })
    }
  }

  const completedAt = clock()
  const succeededCount = results.filter(
    result => result.status === 'SUCCEEDED'
  ).length
  const failedCount = results.length - succeededCount

  const totals = results.reduce(
    (total, result) => addCounts(total, result),
    emptyCounts()
  )

  return {
    success: failedCount === 0,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    sourceCount: results.length,
    succeededCount,
    failedCount,
    totals,
    results
  }
}
