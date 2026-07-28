import { normaliseOpportunityTags } from '#shared/opportunities/tags'
import { fetchPublicHtml } from '../../services/opportunity-link-fetcher'
import { defineOpportunityAdapter } from './contract'

export const HACKEREARTH_LISTINGS_URL =
  'https://www.hackerearth.com/challenges/'
export const HACKEREARTH_REQUEST_PACING_MS = 500
export const HACKEREARTH_MAX_LISTINGS = 40

const entities = value => String(value || '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))

const plain = (value, maximum = 5000) =>
  entities(String(value || ''))
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>|<\/(?:p|div|li|section|article|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, maximum)
    .trim() || null

const attribute = (tag, name) =>
  entities(tag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '') || null

function publicHackerEarthUrl(value, base = HACKEREARTH_LISTINGS_URL) {
  try {
    const url = new URL(value, base)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !/(^|\.)hackerearth\.com$/i.test(url.hostname) ||
      /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(url.pathname)
    ) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function canonicalChallengeUrl(value) {
  const url = publicHackerEarthUrl(value)
  if (!url) return null
  const parsed = new URL(url)
  const match = parsed.pathname.match(
    /^\/challenges\/(hackathon|competitive)\/([^/]+)\//i,
  )
  if (!match) return null
  parsed.pathname = `/challenges/${match[1].toLowerCase()}/${match[2]}/`
  parsed.search = ''
  return parsed.toString()
}

function challengeType(sourceUrl) {
  return /\/challenges\/hackathon\//i.test(sourceUrl)
    ? 'HACKATHON'
    : 'COMPETITION'
}

function externalId(sourceUrl) {
  const match = new URL(sourceUrl).pathname.match(
    /^\/challenges\/(?:hackathon|competitive)\/([^/]+)\//i,
  )
  return match?.[1] || null
}

function tagRules(text) {
  const rules = [
    ['AI', /\b(ai|artificial intelligence)\b/i],
    ['Machine Learning', /\b(machine learning|ml)\b/i],
    ['Data Science', /\bdata science\b/i],
    ['Software Engineering', /\bsoftware engineering\b/i],
    ['Web Development', /\bweb development\b/i],
    ['Mobile Development', /\bmobile development\b/i],
    ['Cloud', /\bcloud\b/i],
    ['Cybersecurity', /\b(cybersecurity|cyber security)\b/i],
    ['Fintech', /\bfintech\b/i],
    ['Sustainability', /\b(sustainab|climate)\w*\b/i],
    ['Product Design', /\bproduct design\b/i],
    ['Business', /\bbusiness\b/i],
    ['Entrepreneurship', /\b(entrepreneur|startup)\w*\b/i],
  ]
  return normaliseOpportunityTags(
    rules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag),
  )
}

function isoFromText(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text.replace(/\s+\((?:UTC|GMT[^)]*)\)\s*$/i, ''))
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function phaseDates(text) {
  const starts = [...text.matchAll(
    /starts?\s+on\s*:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+20\d{2},\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,5})/gi,
  )].map(match => isoFromText(match[1])).filter(Boolean)
  const ends = [...text.matchAll(
    /ends?\s+on\s*:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+20\d{2},\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,5})/gi,
  )].map(match => isoFromText(match[1])).filter(Boolean)
  return {
    startAt: starts.sort()[0] || null,
    endAt: ends.sort().at(-1) || null,
  }
}

function section(html, heading) {
  const match = String(html || '').match(
    new RegExp(`<h[1-6]\\b[^>]*>\\s*(?:${heading})\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6]\\b|$)`, 'i'),
  )
  return plain(match?.[1], 3000)
}

export function extractHackerEarthListingLinks(html) {
  const values = []
  const seen = new Set()
  for (const tag of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const sourceUrl = canonicalChallengeUrl(attribute(tag, 'href'))
    if (!sourceUrl || seen.has(sourceUrl)) continue
    const title = plain(tag, 180)
    if (!title) continue
    seen.add(sourceUrl)
    values.push({ sourceUrl, title })
    if (values.length >= HACKEREARTH_MAX_LISTINGS) break
  }
  return values
}

export function extractHackerEarthDetail(html, sourceUrl) {
  if (!html || !canonicalChallengeUrl(sourceUrl)) return null
  const pageText = plain(html, 40_000)
  const title = plain(
    html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0],
    180,
  )
  if (!title || !pageText || /\bthis campaign is over\b/i.test(pageText)) {
    return null
  }
  const dates = phaseDates(pageText)
  const online = /\bOnline\b/i.test(pageText)
  const inPerson = /\b(in[ -]?person|on-?site|onsite)\b/i.test(pageText)
  const organiser =
    plain(html.match(/data-organizer=["']([^"']+)["']/i)?.[1], 180) ||
    plain(pageText.match(/\b(?:organised|organized|presented)\s+by\s+([^\n.]{2,180})/i)?.[1], 180) ||
    'HackerEarth'
  const requirements = section(html, 'Rules|Requirements')
  const benefits = section(html, 'Prizes?|Awards?')
  const description =
    section(html, 'Overview|About') ||
    plain(
      html.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)
        ? attribute(html.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)?.[0], 'content')
        : null,
      5000,
    )
  return {
    externalId: externalId(sourceUrl),
    title,
    organisation: organiser,
    category: challengeType(sourceUrl),
    description,
    sourceUrl: canonicalChallengeUrl(sourceUrl),
    applicationUrl: canonicalChallengeUrl(sourceUrl),
    publishedAt: null,
    deadline: dates.endAt,
    startAt: dates.startAt,
    endAt: dates.endAt,
    location: inPerson ? plain(pageText.match(/\b(?:venue|location)\s*:\s*([^\n]{2,240})/i)?.[1], 240) : null,
    mode: online && inPerson ? 'HYBRID' : online ? 'ONLINE' : inPerson ? 'IN_PERSON' : 'UNKNOWN',
    commitment: null,
    eligibilityText: plain(
      pageText.match(/\bEligibility\s*:\s*([^\n]{2,1500})/i)?.[1],
      1500,
    ),
    requirements,
    benefits,
    tags: tagRules(`${title} ${description || ''} ${requirements || ''}`),
  }
}

export function createHackerEarthOpportunityAdapter(options = {}) {
  const fetchHtml = options.fetchHtml || fetchPublicHtml
  const paceMs = Math.max(
    HACKEREARTH_REQUEST_PACING_MS,
    options.paceMs ?? HACKEREARTH_REQUEST_PACING_MS,
  )
  const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  return defineOpportunityAdapter({
    key: 'hackerearth',
    name: 'HackerEarth',
    slug: 'hackerearth',
    baseUrl: HACKEREARTH_LISTINGS_URL,
    async fetchCandidates() {
      const { html } = await fetchHtml(HACKEREARTH_LISTINGS_URL)
      const listings = extractHackerEarthListingLinks(html)
      const candidates = []
      for (const listing of listings) {
        await sleep(paceMs)
        try {
          const detail = await fetchHtml(listing.sourceUrl)
          candidates.push(extractHackerEarthDetail(detail.html, listing.sourceUrl) || {})
        } catch {
          candidates.push({})
        }
      }
      return candidates
    },
  })
}

export const hackerEarthOpportunityAdapter =
  createHackerEarthOpportunityAdapter()
