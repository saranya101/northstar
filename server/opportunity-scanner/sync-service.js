import { normalizedAdapterCandidateSchema } from './adapters/contract'
import { getOpportunityAdapter } from './adapters/registry'
import { deduplicateOpportunity, OpportunityDeduplicationResult } from './deduplication'
import { candidateContentHash } from './normalization'

export const DEFAULT_MISSING_LISTING_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000
export const SAFE_SYNC_ERROR_MESSAGE = 'The opportunity source could not be synced.'

export class OpportunitySyncError extends Error {
  constructor(message = SAFE_SYNC_ERROR_MESSAGE, options) {
    super(message, options)
    this.name = 'OpportunitySyncError'
    this.safeMessage = message
  }
}

const opportunityData = (candidate, source) => ({
  title: candidate.title,
  organisation: candidate.organisation,
  category: candidate.category,
  description: candidate.description,
  sourceType: 'PUBLIC_SOURCE',
  sourceName: source.name,
  sourceUrl: candidate.sourceUrl,
  applicationUrl: candidate.applicationUrl,
  publishedAt: candidate.publishedAt,
  deadline: candidate.deadline,
  startAt: candidate.startAt,
  endAt: candidate.endAt,
  location: candidate.location,
  mode: candidate.mode,
  commitment: candidate.commitment,
  eligibilityText: candidate.eligibilityText,
  requirements: candidate.requirements,
  benefits: candidate.benefits,
  tags: candidate.tags,
  createdByUserId: null
})

async function createListing(transaction, source, opportunityId, candidate, hash, now) {
  return transaction.opportunitySourceListing.create({ data: {
    sourceId: source.id,
    opportunityId,
    externalId: candidate.externalId,
    normalizedSourceUrl: candidate.sourceUrl,
    contentHash: hash,
    firstSeenAt: now,
    lastSeenAt: now,
    lastVerifiedAt: now,
    active: true
  } })
}

async function processCandidate(transaction, source, candidate, now) {
  const hash = candidateContentHash(candidate)
  const duplicate = await deduplicateOpportunity(candidate, source.id, transaction)

  if (duplicate.result === OpportunityDeduplicationResult.EXACT_MATCH) {
    const currentListing = duplicate.listing?.sourceId === source.id ? duplicate.listing : await transaction.opportunitySourceListing.findFirst({
      where: { sourceId: source.id, OR: [{ normalizedSourceUrl: candidate.sourceUrl }, ...(candidate.externalId ? [{ externalId: candidate.externalId }] : [])] },
      include: { opportunity: true }
    })
    const listing = currentListing || await createListing(transaction, source, duplicate.opportunity.id, candidate, hash, now)
    const changed = !currentListing || listing.contentHash !== hash
    if (changed) await transaction.opportunity.update({ where: { id: duplicate.opportunity.id }, data: opportunityData(candidate, source) })
    if (currentListing) await transaction.opportunitySourceListing.update({
      where: { id: currentListing.id },
      data: { externalId: candidate.externalId, normalizedSourceUrl: candidate.sourceUrl, contentHash: hash, lastSeenAt: now, lastVerifiedAt: now, active: true }
    })
    return changed ? { updated: 1, duplicate: 0 } : { updated: 0, duplicate: 1 }
  }

  const opportunity = await transaction.opportunity.create({ data: opportunityData(candidate, source) })
  const listing = await createListing(transaction, source, opportunity.id, candidate, hash, now)
  if (duplicate.result === OpportunityDeduplicationResult.PROBABLE_MATCH) {
    await transaction.opportunityDuplicateReview.create({ data: {
      sourceListingId: listing.id,
      candidateOpportunityId: opportunity.id,
      probableMatchOpportunityId: duplicate.opportunity.id,
      fingerprint: duplicate.fingerprint
    } })
    return { created: 1, duplicate: 1 }
  }
  return { created: 1, duplicate: 0 }
}

async function getOrCreateSource(adapter, database) {
  const existing = await database.opportunitySource.findUnique({ where: { adapterKey: adapter.key } })
  if (existing) return existing
  return database.opportunitySource.create({ data: { name: adapter.name, slug: adapter.slug, adapterKey: adapter.key, baseUrl: adapter.baseUrl } })
}

export async function runOpportunitySync(adapterKey, options = {}) {
  let database = options.database
  const now = options.now || new Date()
  const gracePeriodMs = options.missingListingGracePeriodMs ?? DEFAULT_MISSING_LISTING_GRACE_PERIOD_MS
  const adapter = options.adapter || getOpportunityAdapter(adapterKey)
  if (!adapter || adapter.key !== adapterKey) throw new OpportunitySyncError('Unknown opportunity source.')
  if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) throw new OpportunitySyncError('The missing-listing grace period is invalid.')

  let source
  let run
  try {
    if (!database) database = (await import('../utils/prisma')).prisma
    source = await getOrCreateSource(adapter, database)
    await database.opportunitySource.update({ where: { id: source.id }, data: { lastAttemptedAt: now } })
    run = await database.opportunitySyncRun.create({ data: { sourceId: source.id, status: 'RUNNING', startedAt: now } })
    if (!source.enabled) throw new OpportunitySyncError('The opportunity source is disabled.')

    const rawCandidates = await adapter.fetchCandidates({ source })
    if (!Array.isArray(rawCandidates)) throw new OpportunitySyncError()
    const counts = { fetchedCount: rawCandidates.length, createdCount: 0, updatedCount: 0, duplicateCount: 0, invalidCount: 0, closedCount: 0 }

    for (const rawCandidate of rawCandidates) {
      const parsed = normalizedAdapterCandidateSchema.safeParse(rawCandidate)
      if (!parsed.success) { counts.invalidCount += 1; continue }
      const candidate = parsed.data
      const result = await database.$transaction(transaction => processCandidate(transaction, source, candidate, now))
      counts.createdCount += result.created || 0
      counts.updatedCount += result.updated || 0
      counts.duplicateCount += result.duplicate || 0
    }

    const cutoff = new Date(now.getTime() - gracePeriodMs)
    const closed = await database.opportunitySourceListing.updateMany({ where: { sourceId: source.id, active: true, lastSeenAt: { lt: cutoff } }, data: { active: false, lastVerifiedAt: now } })
    counts.closedCount = closed.count
    await database.opportunitySource.update({ where: { id: source.id }, data: { lastSuccessfulAt: now } })
    const completed = await database.opportunitySyncRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', completedAt: now, ...counts } })
    return completed
  } catch (cause) {
    const safeMessage = cause instanceof OpportunitySyncError ? cause.safeMessage : SAFE_SYNC_ERROR_MESSAGE
    if (run && database) await database.opportunitySyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: now, safeErrorMessage: safeMessage } }).catch(() => {})
    throw new OpportunitySyncError(safeMessage, { cause })
  }
}
