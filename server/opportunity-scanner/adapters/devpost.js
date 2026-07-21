import { fetchPublicHtml, fetchPublicJson } from '../../services/opportunity-link-fetcher'
import { defineOpportunityAdapter } from './contract'
import { normaliseOpportunityTags } from '~~/shared/opportunities/tags'

export const DEVPOST_LISTINGS_URL = 'https://devpost.com/api/hackathons'
export const DEVPOST_MAX_PAGES = 2
export const DEVPOST_REQUEST_PACING_MS = 300

const months = new Map([['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['may', 4], ['jun', 5], ['jul', 6], ['aug', 7], ['sep', 8], ['sept', 8], ['oct', 9], ['nov', 10], ['dec', 11]])
const entities = value => String(value || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
const plain = (value, maximum = 5000) => entities(String(value || '').replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<\s*br\s*\/?>|<\/(?:p|div|li|section|article|h[1-6]|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()).slice(0, maximum).trim() || null
const attribute = (tag, name) => entities(tag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '') || null
const absolutePublicUrl = (value, base) => { try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null } catch { return null } }
const publicDevpostUrl = (value, base) => {
  const absolute = absolutePublicUrl(value, base)
  if (!absolute) return null
  const url = new URL(absolute)
  const hostname = url.hostname.toLowerCase()
  if ((hostname !== 'devpost.com' && !hostname.endsWith('.devpost.com')) || hostname === 'secure.devpost.com' || /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(url.pathname)) return null
  return url.toString()
}
const sectionById = (html, tag, id) => html.match(new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || ''

function isoDate(year, month, day, endOfDay = false) {
  const date = new Date(Date.UTC(Number(year), month, Number(day), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== month || date.getUTCDate() !== Number(day)) return null
  return date.toISOString()
}

export function parseDevpostSubmissionPeriod(value) {
  const text = String(value || '').trim()
  let match = text.match(/^([A-Za-z]{3,4})\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),\s*(20\d{2})$/)
  if (match) {
    const month = months.get(match[1].toLowerCase())
    if (month === undefined) return { startAt: null, deadline: null, endAt: null }
    const startAt = isoDate(match[4], month, match[2])
    const deadline = isoDate(match[4], month, match[3], true)
    return { startAt, deadline, endAt: deadline }
  }
  match = text.match(/^([A-Za-z]{3,4})\s+(\d{1,2})(?:,\s*(20\d{2}))?\s*[-–—]\s*([A-Za-z]{3,4})\s+(\d{1,2}),\s*(20\d{2})$/)
  if (!match) return { startAt: null, deadline: null, endAt: null }
  const startMonth = months.get(match[1].toLowerCase())
  const endMonth = months.get(match[4].toLowerCase())
  if (startMonth === undefined || endMonth === undefined) return { startAt: null, deadline: null, endAt: null }
  const endYear = Number(match[6])
  const startYear = Number(match[3] || (startMonth > endMonth ? endYear - 1 : endYear))
  const startAt = isoDate(startYear, startMonth, match[2])
  const deadline = isoDate(endYear, endMonth, match[5], true)
  return { startAt, deadline, endAt: deadline }
}

function modeAndLocation(displayedLocation) {
  const value = plain(displayedLocation?.location, 240)
  if (!value) return { mode: 'UNKNOWN', location: null }
  if (/\bhybrid\b/i.test(value)) return { mode: 'HYBRID', location: value }
  if (/^(online|virtual)$/i.test(value)) return { mode: 'ONLINE', location: null }
  if (/\b(online|virtual)\b/i.test(value) && /\b(in[ -]?person|on-?site)\b/i.test(value)) return { mode: 'HYBRID', location: value }
  return { mode: 'IN_PERSON', location: value }
}

export function extractDevpostListing(listing) {
  if (!listing || !Number.isInteger(listing.id) || !plain(listing.title, 180) || !plain(listing.organization_name, 180) || !publicDevpostUrl(listing.url, DEVPOST_LISTINGS_URL)) return null
  const dates = parseDevpostSubmissionPeriod(listing.submission_period_dates)
  const place = modeAndLocation(listing.displayed_location)
  const sourceUrl = publicDevpostUrl(listing.url, DEVPOST_LISTINGS_URL)
  return {
    externalId: String(listing.id),
    title: plain(listing.title, 180),
    organisation: plain(listing.organization_name, 180),
    category: /\bhack(?:athon|s)?\b/i.test(listing.title) ? 'HACKATHON' : 'COMPETITION',
    description: null,
    sourceUrl,
    applicationUrl: publicDevpostUrl(listing.start_a_submission_url, sourceUrl),
    publishedAt: null,
    deadline: dates.deadline,
    startAt: dates.startAt,
    endAt: dates.endAt,
    location: place.location,
    mode: place.mode,
    eligibilityText: listing.invite_only ? plain(listing.eligibility_requirement_invite_only_description, 3000) : null,
    requirements: null,
    benefits: null,
    tags: normaliseOpportunityTags((listing.themes || []).map(theme => plain(theme?.name, 40)).filter(Boolean))
  }
}

export function extractDevpostDetail(html, sourceUrl) {
  if (!html || /awsWafIntegration|challenge-container/i.test(html)) return {}
  const descriptionTag = (html.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i) || [])[0]
  const deadlineTag = (html.match(/<time\b[^>]*\bid=["']time-left["'][^>]*>/i) || [])[0]
  const applicationTag = (html.match(/<a\b[^>]*\bdata-main-register-button=["']true["'][^>]*>/i) || [])[0]
  const eligibility = plain(sectionById(html, 'ul', 'eligibility-list'), 3000)
  const requirements = plain(sectionById(html, 'article', 'challenge-requirements'), 3000)
  const prizes = plain(sectionById(html, 'article', 'prizes'), 3000)
  const deadlineValue = attribute(deadlineTag, 'datetime')
  const deadline = deadlineValue && !Number.isNaN(new Date(deadlineValue).valueOf()) ? new Date(deadlineValue).toISOString() : null
  const pageText = plain(html, 20_000) || ''
  const explicitMode = /\bhybrid\b/i.test(pageText) ? 'HYBRID' : /\bOnline\b/i.test(pageText) ? 'ONLINE' : /\b(in[ -]?person|on-?site)\b/i.test(pageText) ? 'IN_PERSON' : null
  return {
    description: plain(attribute(descriptionTag, 'content'), 5000),
    applicationUrl: publicDevpostUrl(attribute(applicationTag, 'href'), sourceUrl),
    deadline,
    mode: explicitMode,
    eligibilityText: eligibility,
    requirements,
    benefits: prizes
  }
}

function mergeDetail(candidate, detail) {
  const result = { ...candidate }
  for (const key of ['description', 'applicationUrl', 'deadline', 'mode', 'eligibilityText', 'requirements', 'benefits']) if (detail[key]) result[key] = detail[key]
  if (detail.deadline) result.endAt = detail.deadline
  return result
}

export function createDevpostOpportunityAdapter(options = {}) {
  const fetchJson = options.fetchJson || fetchPublicJson
  const fetchHtml = options.fetchHtml || fetchPublicHtml
  const maxPages = Math.max(1, Math.min(options.maxPages || DEVPOST_MAX_PAGES, DEVPOST_MAX_PAGES))
  const paceMs = Math.max(DEVPOST_REQUEST_PACING_MS, options.paceMs ?? DEVPOST_REQUEST_PACING_MS)
  const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  return defineOpportunityAdapter({
    key: 'devpost',
    name: 'Devpost',
    slug: 'devpost',
    baseUrl: 'https://devpost.com/hackathons',
    async fetchCandidates() {
      const candidates = []
      for (let page = 1; page <= maxPages; page += 1) {
        if (page > 1) await sleep(paceMs)
        const url = new URL(DEVPOST_LISTINGS_URL)
        url.searchParams.append('status[]', 'upcoming')
        url.searchParams.append('status[]', 'open')
        url.searchParams.set('page', String(page))
        const { data } = await fetchJson(url.toString())
        if (!Array.isArray(data?.hackathons)) throw new Error('Invalid Devpost listing response.')
        for (const listing of data.hackathons) {
          const candidate = extractDevpostListing(listing)
          if (!candidate) { candidates.push({}); continue }
          await sleep(paceMs)
          try {
            const { html } = await fetchHtml(candidate.sourceUrl)
            candidates.push(mergeDetail(candidate, extractDevpostDetail(html, candidate.sourceUrl)))
          } catch { candidates.push(candidate) }
        }
        if (data.hackathons.length === 0 || candidates.length >= Number(data.meta?.total_count || Infinity)) break
      }
      return candidates
    }
  })
}

export const devpostOpportunityAdapter = createDevpostOpportunityAdapter()
