import { getOpportunityAdapter } from './adapters/registry'
import { OpportunitySyncError, runOpportunitySync } from './sync-service'

export function parseOpportunitySyncArgs(args) {
  const sourceArguments = args.filter(argument => argument.startsWith('--source='))
  if (sourceArguments.length !== 1 || args.length !== 1) throw new OpportunitySyncError('Usage: npm run opportunities:sync -- --source=<adapter-key>')
  const source = sourceArguments[0].slice('--source='.length).trim()
  if (!source || !getOpportunityAdapter(source)) throw new OpportunitySyncError('Unknown opportunity source.')
  return { source }
}

export async function runOpportunitySyncCli(args = process.argv.slice(2), output = console, sync = runOpportunitySync) {
  try {
    const { source } = parseOpportunitySyncArgs(args)
    const run = await sync(source)
    output.log(`Opportunity sync succeeded: fetched=${run.fetchedCount} created=${run.createdCount} updated=${run.updatedCount} duplicates=${run.duplicateCount} invalid=${run.invalidCount} closed=${run.closedCount}`)
    return 0
  } catch (cause) {
    output.error(cause instanceof OpportunitySyncError ? cause.safeMessage : 'The opportunity source could not be synced.')
    return 1
  }
}
