import { duplicateFingerprint } from './normalization'

export const OpportunityDeduplicationResult = Object.freeze({
  EXACT_MATCH: 'EXACT_MATCH',
  PROBABLE_MATCH: 'PROBABLE_MATCH',
  NEW: 'NEW'
})

const publicOpportunityWhere = { createdByUserId: null, sourceType: 'PUBLIC_SOURCE' }

export async function deduplicateOpportunity(candidate, sourceId, database) {
  const exactConditions = [{ normalizedSourceUrl: candidate.sourceUrl }]
  if (candidate.externalId) exactConditions.unshift({ sourceId, externalId: candidate.externalId })
  const listing = await database.opportunitySourceListing.findFirst({
    where: { OR: exactConditions },
    include: { opportunity: true }
  })
  if (listing) return { result: OpportunityDeduplicationResult.EXACT_MATCH, evidence: listing.externalId === candidate.externalId && candidate.externalId ? 'SOURCE_EXTERNAL_ID' : 'NORMALIZED_SOURCE_URL', opportunity: listing.opportunity, listing }

  if (candidate.applicationUrl) {
    const opportunity = await database.opportunity.findFirst({ where: { ...publicOpportunityWhere, applicationUrl: candidate.applicationUrl } })
    if (opportunity) return { result: OpportunityDeduplicationResult.EXACT_MATCH, evidence: 'NORMALIZED_APPLICATION_URL', opportunity, listing: null }
  }

  const fingerprint = duplicateFingerprint(candidate)
  const possible = await database.opportunity.findMany({
    where: { ...publicOpportunityWhere, title: { equals: candidate.title, mode: 'insensitive' }, organisation: { equals: candidate.organisation, mode: 'insensitive' }, deadline: candidate.deadline },
    take: 20
  })
  const opportunity = possible.find(item => duplicateFingerprint(item) === fingerprint)
  if (opportunity) return { result: OpportunityDeduplicationResult.PROBABLE_MATCH, evidence: 'TITLE_ORGANISATION_DEADLINE', opportunity, listing: null, fingerprint }
  return { result: OpportunityDeduplicationResult.NEW, evidence: null, opportunity: null, listing: null, fingerprint }
}
