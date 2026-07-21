import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { adapterCandidateSchema } from '../server/opportunity-scanner/adapters/contract'
import { createDevpostOpportunityAdapter, extractDevpostDetail, extractDevpostListing, parseDevpostSubmissionPeriod } from '../server/opportunity-scanner/adapters/devpost'
import { createMockOpportunityAdapter } from '../server/opportunity-scanner/adapters/mock'
import { parseOpportunitySyncArgs, runOpportunitySyncCli } from '../server/opportunity-scanner/cli'
import { deduplicateOpportunity } from '../server/opportunity-scanner/deduplication'
import { normalizeAdapterCandidate } from '../server/opportunity-scanner/normalization'
import { runOpportunitySync } from '../server/opportunity-scanner/sync-service'
import { listOpportunities } from '../server/services/opportunities'

const at = value => new Date(value)
const devpostListings = JSON.parse(readFileSync(new URL('./fixtures/devpost-hackathons.json', import.meta.url), 'utf8'))
const devpostOnlineDetail = readFileSync(new URL('./fixtures/devpost-hackathon-detail.html', import.meta.url), 'utf8')
const devpostInPersonDetail = readFileSync(new URL('./fixtures/devpost-hackathon-in-person-detail.html', import.meta.url), 'utf8')
const candidate = (overrides = {}) => ({
  externalId: 'listing-1', title: 'Student Builder', organisation: 'Northstar Labs', category: 'INTERNSHIP',
  description: 'Build useful things.', sourceUrl: 'https://MOCK.example/opportunities/1?utm_source=test#details', applicationUrl: 'https://apply.example/1',
  publishedAt: '2026-07-01T00:00:00.000Z', deadline: '2026-08-01T00:00:00.000Z', startAt: null, endAt: null,
  location: 'Singapore', mode: 'HYBRID', eligibilityText: 'Students', requirements: 'Curiosity', benefits: 'Mentorship', tags: ['Students', 'students'], ...overrides
})

function createScannerDatabase() {
  const state = {
    source: { id: 'source-1', name: 'Mock opportunities', slug: 'mock', adapterKey: 'mock', baseUrl: 'https://mock.example/', enabled: true },
    opportunities: [], listings: [], runs: [], reviews: [], personal: [{ userId: 'u1', opportunityId: 'future', status: 'APPLIED', notes: 'Keep me' }]
  }
  let sequence = 0
  const id = prefix => `${prefix}-${++sequence}`
  const matchesListing = (listing, where) => {
    if (where.sourceId && listing.sourceId !== where.sourceId) return false
    if (where.externalId !== undefined && listing.externalId !== where.externalId) return false
    if (where.normalizedSourceUrl !== undefined && listing.normalizedSourceUrl !== where.normalizedSourceUrl) return false
    if (where.OR && !where.OR.some(condition => matchesListing(listing, condition))) return false
    return true
  }
  const database = {
    opportunitySource: {
      findUnique: vi.fn(async ({ where }) => state.source.adapterKey === where.adapterKey ? { ...state.source } : null),
      create: vi.fn(async ({ data }) => (state.source = { id: id('source'), enabled: true, ...data })),
      update: vi.fn(async ({ data }) => (Object.assign(state.source, data), { ...state.source }))
    },
    opportunitySyncRun: {
      create: vi.fn(async ({ data }) => { const run = { id: id('run'), fetchedCount: 0, createdCount: 0, updatedCount: 0, duplicateCount: 0, invalidCount: 0, closedCount: 0, safeErrorMessage: null, ...data }; state.runs.push(run); return { ...run } }),
      update: vi.fn(async ({ where, data }) => { const run = state.runs.find(item => item.id === where.id); Object.assign(run, data); return { ...run } })
    },
    opportunitySourceListing: {
      findFirst: vi.fn(async ({ where, include }) => { const listing = state.listings.find(item => matchesListing(item, where)); return listing ? { ...listing, ...(include?.opportunity && { opportunity: { ...state.opportunities.find(item => item.id === listing.opportunityId) } }) } : null }),
      create: vi.fn(async ({ data }) => { const listing = { id: id('listing'), ...data }; state.listings.push(listing); return { ...listing } }),
      update: vi.fn(async ({ where, data }) => { const listing = state.listings.find(item => item.id === where.id); Object.assign(listing, data); return { ...listing } }),
      updateMany: vi.fn(async ({ where, data }) => { const rows = state.listings.filter(item => item.sourceId === where.sourceId && item.active === where.active && item.lastSeenAt < where.lastSeenAt.lt); rows.forEach(item => Object.assign(item, data)); return { count: rows.length } })
    },
    opportunity: {
      create: vi.fn(async ({ data }) => { const opportunity = { id: id('opportunity'), createdAt: new Date(), updatedAt: new Date(), ...data }; state.opportunities.push(opportunity); return { ...opportunity } }),
      update: vi.fn(async ({ where, data }) => { const opportunity = state.opportunities.find(item => item.id === where.id); Object.assign(opportunity, data); return { ...opportunity } }),
      findFirst: vi.fn(async ({ where }) => state.opportunities.find(item => item.createdByUserId === null && item.sourceType === 'PUBLIC_SOURCE' && item.applicationUrl === where.applicationUrl) || null),
      findMany: vi.fn(async ({ where }) => state.opportunities.filter(item => item.createdByUserId === null && item.sourceType === 'PUBLIC_SOURCE' && item.title.toLowerCase() === where.title.equals.toLowerCase() && item.organisation.toLowerCase() === where.organisation.equals.toLowerCase() && String(item.deadline) === String(where.deadline)))
    },
    opportunityDuplicateReview: { create: vi.fn(async ({ data }) => { const review = { id: id('review'), ...data }; state.reviews.push(review); return review }) },
    $transaction: callback => callback(database)
  }
  return { database, state }
}

describe('public opportunity adapter contract and deduplication', () => {
  it('accepts the normalized contract and rejects extra or HTML-bearing adapter data', () => {
    expect(adapterCandidateSchema.safeParse(candidate()).success).toBe(true)
    expect(adapterCandidateSchema.safeParse(candidate({ rawHtml: '<main>secret</main>' })).success).toBe(false)
    expect(adapterCandidateSchema.safeParse(candidate({ description: '<p>raw HTML</p>' })).success).toBe(false)
    expect(adapterCandidateSchema.safeParse(candidate({ sourceUrl: 'https://user:password@example.com/listing' })).success).toBe(false)
  })

  it('returns exact evidence for an existing source external ID', async () => {
    const normalized = normalizeAdapterCandidate(adapterCandidateSchema.parse(candidate()))
    const listing = { sourceId: 'source-1', externalId: 'listing-1', opportunity: { id: 'existing' } }
    const database = { opportunitySourceListing: { findFirst: vi.fn().mockResolvedValue(listing) }, opportunity: { findFirst: vi.fn(), findMany: vi.fn() } }
    await expect(deduplicateOpportunity(normalized, 'source-1', database)).resolves.toMatchObject({ result: 'EXACT_MATCH', evidence: 'SOURCE_EXTERNAL_ID', opportunity: { id: 'existing' } })
  })

  it('returns probable evidence only for the title, organisation and deadline fingerprint', async () => {
    const normalized = normalizeAdapterCandidate(adapterCandidateSchema.parse(candidate()))
    const probable = { id: 'probable', ...normalized, createdByUserId: null, sourceType: 'PUBLIC_SOURCE' }
    const database = { opportunitySourceListing: { findFirst: vi.fn().mockResolvedValue(null) }, opportunity: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([probable]) } }
    await expect(deduplicateOpportunity(normalized, 'source-1', database)).resolves.toMatchObject({ result: 'PROBABLE_MATCH', evidence: 'TITLE_ORGANISATION_DEADLINE', opportunity: { id: 'probable' } })
  })
})

describe('public opportunity sync', () => {
  it('creates a public opportunity and records complete run counts', async () => {
    const { database, state } = createScannerDatabase()
    const run = await runOpportunitySync('mock', { database, adapter: createMockOpportunityAdapter([candidate()]), now: at('2026-07-21T00:00:00.000Z') })
    expect(run).toMatchObject({ status: 'SUCCEEDED', fetchedCount: 1, createdCount: 1, updatedCount: 0, duplicateCount: 0, invalidCount: 0, closedCount: 0 })
    expect(state.opportunities[0]).toMatchObject({ sourceType: 'PUBLIC_SOURCE', createdByUserId: null })
    expect(state.listings[0]).toMatchObject({ active: true, firstSeenAt: at('2026-07-21T00:00:00.000Z'), lastVerifiedAt: at('2026-07-21T00:00:00.000Z') })
  })

  it('updates changed content, then makes an unchanged sync idempotent', async () => {
    const { database, state } = createScannerDatabase()
    const candidates = [candidate()]
    const adapter = createMockOpportunityAdapter(candidates)
    await runOpportunitySync('mock', { database, adapter, now: at('2026-07-21T00:00:00.000Z') })
    candidates[0].description = 'Changed description.'
    const changed = await runOpportunitySync('mock', { database, adapter, now: at('2026-07-22T00:00:00.000Z') })
    const unchanged = await runOpportunitySync('mock', { database, adapter, now: at('2026-07-23T00:00:00.000Z') })
    expect(changed).toMatchObject({ createdCount: 0, updatedCount: 1 })
    expect(unchanged).toMatchObject({ createdCount: 0, updatedCount: 0, duplicateCount: 1 })
    expect(state.opportunities).toHaveLength(1)
    expect(state.opportunities[0].description).toBe('Changed description.')
  })

  it('isolates invalid listings and never persists raw HTML', async () => {
    const { database, state } = createScannerDatabase()
    const run = await runOpportunitySync('mock', { database, adapter: createMockOpportunityAdapter([candidate(), candidate({ externalId: 'bad', sourceUrl: 'https://mock.example/bad', description: '<article>raw</article>' })]), now: at('2026-07-21T00:00:00.000Z') })
    expect(run).toMatchObject({ status: 'SUCCEEDED', fetchedCount: 2, createdCount: 1, invalidCount: 1 })
    expect(JSON.stringify(state.opportunities)).not.toContain('<article>')
  })

  it('keeps probable matches separate and records them for review', async () => {
    const { database, state } = createScannerDatabase()
    const normalized = normalizeAdapterCandidate(adapterCandidateSchema.parse(candidate({ sourceUrl: 'https://mock.example/old', applicationUrl: null })))
    state.opportunities.push({ id: 'existing', ...normalized, createdByUserId: null, sourceType: 'PUBLIC_SOURCE' })
    const run = await runOpportunitySync('mock', { database, adapter: createMockOpportunityAdapter([candidate({ externalId: 'new-id', sourceUrl: 'https://mock.example/new', applicationUrl: null })]), now: at('2026-07-21T00:00:00.000Z') })
    expect(run).toMatchObject({ createdCount: 1, duplicateCount: 1 })
    expect(state.opportunities).toHaveLength(2)
    expect(state.reviews).toHaveLength(1)
  })

  it('marks missing listings unavailable only after the configured grace period', async () => {
    const { database, state } = createScannerDatabase()
    const candidates = [candidate()]
    const adapter = createMockOpportunityAdapter(candidates)
    await runOpportunitySync('mock', { database, adapter, now: at('2026-07-01T00:00:00.000Z'), missingListingGracePeriodMs: 7 * 86_400_000 })
    candidates.length = 0
    const withinGrace = await runOpportunitySync('mock', { database, adapter, now: at('2026-07-07T00:00:00.000Z'), missingListingGracePeriodMs: 7 * 86_400_000 })
    const afterGrace = await runOpportunitySync('mock', { database, adapter, now: at('2026-07-09T00:00:00.000Z'), missingListingGracePeriodMs: 7 * 86_400_000 })
    expect(withinGrace.closedCount).toBe(0)
    expect(afterGrace.closedCount).toBe(1)
    expect(state.listings[0].active).toBe(false)
  })

  it('does not touch personal status, notes, deadlines or application state', async () => {
    const { database, state } = createScannerDatabase()
    const before = structuredClone(state.personal)
    await runOpportunitySync('mock', { database, adapter: createMockOpportunityAdapter([candidate()]), now: at('2026-07-21T00:00:00.000Z') })
    expect(state.personal).toEqual(before)
    expect(database).not.toHaveProperty('userOpportunity.update')
  })
})

describe('public opportunity visibility and CLI validation', () => {
  it('shows public records to both users while isolating each private record and personal status', async () => {
    const publicOpportunity = { id: 'public', title: 'Public', organisation: 'Org', category: 'OTHER', sourceType: 'PUBLIC_SOURCE', sourceName: 'Mock', mode: 'ONLINE', tags: [], createdByUserId: null, deadline: null, startAt: null, endAt: null, createdAt: at('2026-07-01T00:00:00.000Z'), updatedAt: at('2026-07-01T00:00:00.000Z'), sourceListings: [{ active: true, firstSeenAt: at('2026-07-01T00:00:00.000Z'), lastSeenAt: at('2026-07-02T00:00:00.000Z'), lastVerifiedAt: at('2026-07-02T00:00:00.000Z'), source: { name: 'Mock' } }] }
    const privateOne = { ...publicOpportunity, id: 'private-1', title: 'Private one', sourceType: 'MANUAL', createdByUserId: 'u1', sourceListings: [] }
    const privateTwo = { ...publicOpportunity, id: 'private-2', title: 'Private two', sourceType: 'MANUAL', createdByUserId: 'u2', sourceListings: [] }
    const records = [publicOpportunity, privateOne, privateTwo]
    const database = {
      opportunity: {
        findMany: vi.fn(async ({ where, include }) => { const userId = where.OR[0].createdByUserId; return records.filter(item => item.createdByUserId === userId || (item.createdByUserId === null && item.sourceType === 'PUBLIC_SOURCE')).map(item => ({ ...item, userOpportunities: item.id === 'public' ? [{ userId, status: userId === 'u1' ? 'INTERESTED' : 'SAVED' }] : [] })) }),
        count: vi.fn().mockResolvedValue(2)
      },
      userOpportunity: { count: vi.fn().mockResolvedValue(0) }
    }
    const filters = { search: '', closingSoon: false, upcoming: false, expired: false, sort: 'deadline', page: 1, pageSize: 20 }
    const one = await listOpportunities('u1', filters, database)
    const two = await listOpportunities('u2', filters, database)
    expect(one.items.map(item => item.id)).toEqual(['public', 'private-1'])
    expect(two.items.map(item => item.id)).toEqual(['public', 'private-2'])
    expect(one.items[0].personal.status).toBe('INTERESTED')
    expect(two.items[0].personal.status).toBe('SAVED')
  })

  it('rejects missing and unknown CLI source keys without running a sync', () => {
    expect(() => parseOpportunitySyncArgs([])).toThrow('Usage:')
    expect(() => parseOpportunitySyncArgs(['--source=unknown'])).toThrow('Unknown opportunity source.')
    expect(parseOpportunitySyncArgs(['--source=mock'])).toEqual({ source: 'mock' })
  })
})

describe('Devpost opportunity adapter', () => {
  it('extracts listing fields, conservative dates, and explicit online/in-person modes', () => {
    const online = extractDevpostListing(devpostListings.hackathons[0])
    const inPerson = extractDevpostListing(devpostListings.hackathons[1])
    expect(online).toMatchObject({ externalId: '29541', title: 'Build with Gemini XPRIZE', organisation: 'XPRIZE', category: 'COMPETITION', sourceUrl: 'https://xprize.devpost.com/', mode: 'ONLINE', location: null, startAt: '2026-05-19T00:00:00.000Z', deadline: '2026-08-17T23:59:59.999Z' })
    expect(online.tags).toEqual(['AI', 'Education'])
    expect(inPerson).toMatchObject({ category: 'HACKATHON', mode: 'IN_PERSON', location: 'Singapore' })
    expect(extractDevpostListing(devpostListings.hackathons[2])).toBeNull()
    expect(extractDevpostListing({ ...devpostListings.hackathons[0], url: 'https://secure.devpost.com/users/login' })).toBeNull()
    expect(parseDevpostSubmissionPeriod('Dec 29 - Jan 5, 2027')).toMatchObject({ startAt: '2026-12-29T00:00:00.000Z', deadline: '2027-01-05T23:59:59.999Z' })
    expect(parseDevpostSubmissionPeriod('sometime soon')).toEqual({ startAt: null, deadline: null, endAt: null })
  })

  it('extracts bounded plain-text detail fields and exact deadline timestamps', () => {
    const online = extractDevpostDetail(devpostOnlineDetail, 'https://xprize.devpost.com/')
    const inPerson = extractDevpostDetail(devpostInPersonDetail, 'https://campus-climate.devpost.com/')
    expect(online).toMatchObject({ description: 'Build a real product with Gemini and Google Cloud.', applicationUrl: 'https://xprize.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=29541', deadline: '2026-08-17T20:00:00.000Z', mode: 'ONLINE' })
    expect(online.eligibilityText).toMatch(/legal age.*individuals and teams/is)
    expect(online.requirements).toMatch(/Use Gemini.*three-minute demo/is)
    expect(online.benefits).toMatch(/2,000,000 in cash prizes/i)
    expect(inPerson).toMatchObject({ mode: 'IN_PERSON', deadline: '2026-09-14T10:00:00.000Z', applicationUrl: 'https://campus-climate.devpost.com/register' })
    expect(JSON.stringify({ online, inPerson })).not.toMatch(/<\/?(?:html|article|p|li|script)\b/i)
  })

  it('isolates malformed listings, stays idempotent, and updates changed content through the sync pipeline', async () => {
    const { database, state } = createScannerDatabase()
    Object.assign(state.source, { name: 'Devpost', slug: 'devpost', adapterKey: 'devpost', baseUrl: 'https://devpost.com/hackathons' })
    const payload = structuredClone(devpostListings)
    const adapter = createDevpostOpportunityAdapter({ maxPages: 1, fetchJson: vi.fn(async () => ({ data: payload })), fetchHtml: vi.fn(async url => ({ html: url.includes('campus-climate') ? devpostInPersonDetail : devpostOnlineDetail })), sleep: vi.fn() })
    const first = await runOpportunitySync('devpost', { database, adapter, now: at('2026-07-21T00:00:00.000Z') })
    const second = await runOpportunitySync('devpost', { database, adapter, now: at('2026-07-22T00:00:00.000Z') })
    payload.hackathons[0].title = 'Build with Gemini XPRIZE — Updated'
    const changed = await runOpportunitySync('devpost', { database, adapter, now: at('2026-07-23T00:00:00.000Z') })
    expect(first).toMatchObject({ fetchedCount: 3, createdCount: 2, invalidCount: 1 })
    expect(second).toMatchObject({ createdCount: 0, updatedCount: 0, duplicateCount: 2, invalidCount: 1 })
    expect(changed).toMatchObject({ createdCount: 0, updatedCount: 1, duplicateCount: 1, invalidCount: 1 })
    expect(state.opportunities).toHaveLength(2)
    expect(state.opportunities.find(item => item.sourceUrl === 'https://xprize.devpost.com/').title).toContain('Updated')
    expect(JSON.stringify(state.opportunities)).not.toMatch(/<\/?(?:html|article|script)\b/i)
  })

  it('reports a safe successful CLI summary for the registered Devpost source', async () => {
    const output = { log: vi.fn(), error: vi.fn() }
    const code = await runOpportunitySyncCli(['--source=devpost'], output, vi.fn().mockResolvedValue({ fetchedCount: 3, createdCount: 2, updatedCount: 0, duplicateCount: 0, invalidCount: 1, closedCount: 0 }))
    expect(code).toBe(0)
    expect(output.log).toHaveBeenCalledWith('Opportunity sync succeeded: fetched=3 created=2 updated=0 duplicates=0 invalid=1 closed=0')
    expect(output.error).not.toHaveBeenCalled()
  })
})
