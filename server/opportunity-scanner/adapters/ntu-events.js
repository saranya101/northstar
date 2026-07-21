import { fetchPublicJson } from '../../services/opportunity-link-fetcher'
import { defineOpportunityAdapter } from './contract'

export const NTU_EVENTS_LISTINGS_URL =
  'https://www.ntu.edu.sg/events/GetEvents/'

export const NTU_EVENTS_MAX_PAGES = 20
export const NTU_EVENTS_REQUEST_PACING_MS = 300

const entities = value =>
  String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(
      /&#(\d+);/g,
      (_, code) => String.fromCharCode(Number(code)),
    )

const plain = (value, maximum = 5000) =>
  entities(
    String(value || '')
      .replace(
        /<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi,
        ' ',
      )
      .replace(
        /<\s*br\s*\/?>|<\/(?:p|div|li|section|article|h[1-6]|tr)>/gi,
        '\n',
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim(),
  )
    .slice(0, maximum)
    .trim() || null

function publicNtuUrl(value, base = NTU_EVENTS_LISTINGS_URL) {
  try {
    const url = new URL(value, base)

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !/(^|\.)ntu\.edu\.sg$/i.test(url.hostname)
    ) {
      return null
    }

    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function parseNtuEventTimestamp(value) {
  const text = String(value || '').trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const result = new Date(`${text}T00:00:00+08:00`)
    return Number.isNaN(result.valueOf()) ? null : result.toISOString()
  }

  const timed = text.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
  )

  if (!timed) return null

  const result = new Date(
    `${timed[1]}-${timed[2]}-${timed[3]}T` +
      `${timed[4]}:${timed[5]}:${timed[6]}+08:00`,
  )

  return Number.isNaN(result.valueOf()) ? null : result.toISOString()
}

export function parseNtuEventDates(listing) {
  const startAt = parseNtuEventTimestamp(listing?.eventstart)
  let endAt = parseNtuEventTimestamp(listing?.eventend)

  const allDay =
    listing?.alldayevent === 1 ||
    listing?.alldayevent === '1' ||
    listing?.alldayevent === true

  if (allDay && startAt) {
    const start = new Date(startAt)

    if (endAt) {
      const end = new Date(endAt)

      // NTU represents all-day end dates as exclusive.
      if (end > start) {
        endAt = new Date(end.getTime() - 1).toISOString()
      } else {
        endAt = new Date(
          start.getTime() + 86_400_000 - 1,
        ).toISOString()
      }
    } else {
      endAt = new Date(
        start.getTime() + 86_400_000 - 1,
      ).toISOString()
    }
  }

  return { startAt, endAt }
}

export function classifyNtuEvent(listing) {
  const text = [
    listing?.tag,
    listing?.title,
    listing?.description,
    listing?.content,
  ]
    .filter(Boolean)
    .join(' ')

  if (/\bhack(?:athon|s)?\b/i.test(text)) return 'HACKATHON'

  if (
    /\b(competition|challenge|case competition|contest)\b/i.test(text)
  ) {
    return 'COMPETITION'
  }

  if (
    /\b(workshop|masterclass|training|bootcamp|class|course)\b/i.test(
      text,
    )
  ) {
    return 'WORKSHOP'
  }

  if (
    /\b(networking|career fair|recruitment fair|employer event)\b/i.test(
      text,
    )
  ) {
    return 'NETWORKING'
  }

  if (
    /\b(conference|seminar|lecture|talk|symposium|forum|webinar)\b/i.test(
      text,
    )
  ) {
    return 'TALK'
  }

  if (/\b(certification|certificate programme)\b/i.test(text)) {
    return 'CERTIFICATION'
  }

  if (/\b(leadership|committee leader)\b/i.test(text)) {
    return 'LEADERSHIP'
  }

  if (/\b(club|student activit(?:y|ies)|student organisation)\b/i.test(text)) {
    return 'CLUB'
  }

  if (
    /\b(startup|entrepreneur|founder|incubator|accelerator|venture)\b/i.test(
      text,
    )
  ) {
    return 'ENTREPRENEURSHIP'
  }

  if (/\b(research|researcher|research assistant)\b/i.test(text)) {
    return 'RESEARCH'
  }

  return 'OTHER'
}

function extractTags(listing) {
  const text = [
    listing?.title,
    listing?.tag,
    listing?.description,
    listing?.content,
  ]
    .filter(Boolean)
    .join(' ')

  const rules = [
    ['AI', /\b(ai|artificial intelligence|machine learning)\b/i],
    ['Education', /\b(education|teaching|learning|pedagog)\w*\b/i],
    ['Finance', /\b(finance|financial|banking|investment)\b/i],
    ['Business', /\b(business|management|commerce)\b/i],
    ['Sustainability', /\b(sustainab|climate|environment)\w*\b/i],
    ['Career', /\b(career|employment|recruit|job|internship)\w*\b/i],
    ['Networking', /\b(networking|connect with|industry mixer)\b/i],
    ['Leadership', /\b(leadership|leader)\w*\b/i],
    ['Technology', /\b(technology|digital|software|computing|tech)\b/i],
    ['Research', /\b(research|academic study)\b/i],
    ['Entrepreneurship', /\b(startup|entrepreneur|founder|venture)\w*\b/i],
    [
      'Personal Development',
      /\b(personal development|professional development|self-development)\b/i,
    ],
  ]

  return rules
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag)
    .slice(0, 12)
}

function modeAndLocation(listing) {
  const location = plain(listing?.location, 240)

  const text = [
    location,
    listing?.title,
    listing?.description,
    listing?.content,
  ]
    .filter(Boolean)
    .join(' ')

  const online =
    /\b(online|virtual|zoom|microsoft teams|webinar)\b/i.test(text)

  const hybrid = /\bhybrid\b/i.test(text)

  if (hybrid) {
    return {
      mode: 'HYBRID',
      location,
    }
  }

  if (
    online &&
    location &&
    !/^(online|virtual|zoom|microsoft teams)$/i.test(location)
  ) {
    return {
      mode: 'HYBRID',
      location,
    }
  }

  if (online) {
    return {
      mode: 'ONLINE',
      location: null,
    }
  }

  if (location) {
    return {
      mode: 'IN_PERSON',
      location,
    }
  }

  return {
    mode: 'UNKNOWN',
    location: null,
  }
}

function externalIdFromUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl)
    return `${url.pathname}${url.search}`.slice(0, 500)
  } catch {
    return null
  }
}

export function extractNtuEventListing(listing) {
  if (!listing || typeof listing !== 'object') return null

  const sourceUrl = publicNtuUrl(listing.url)
  const title = plain(listing.title, 180)
  const externalId = sourceUrl
    ? externalIdFromUrl(sourceUrl)
    : null

  if (!sourceUrl || !title || !externalId) return null

  const dates = parseNtuEventDates(listing)
  const place = modeAndLocation(listing)

  const description =
    plain(listing.description, 5000) ||
    plain(listing.content, 5000)

  const displayedSchedule = [
    plain(listing.date, 300),
    plain(listing.time, 150),
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    externalId,
    title,
    organisation: 'Nanyang Technological University',
    category: classifyNtuEvent(listing),
    description,
    sourceUrl,
    applicationUrl: null,
    publishedAt: null,

    // Event end dates are not application deadlines.
    deadline: null,

    startAt: dates.startAt,
    endAt: dates.endAt,
    location: place.location,
    mode: place.mode,
    commitment: displayedSchedule || null,
    eligibilityText: null,
    requirements: null,
    benefits: null,
    tags: extractTags(listing),
  }
}

export function createNtuEventsOpportunityAdapter(options = {}) {
  const fetchJson = options.fetchJson || fetchPublicJson

  const maxPages = Math.max(
    1,
    Math.min(
      options.maxPages || NTU_EVENTS_MAX_PAGES,
      NTU_EVENTS_MAX_PAGES,
    ),
  )

  const paceMs = Math.max(
    NTU_EVENTS_REQUEST_PACING_MS,
    options.paceMs ?? NTU_EVENTS_REQUEST_PACING_MS,
  )

  const sleep =
    options.sleep ||
    (milliseconds =>
      new Promise(resolve => setTimeout(resolve, milliseconds)))

  return defineOpportunityAdapter({
    key: 'ntu-events',
    name: 'NTU Events',
    slug: 'ntu-events',
    baseUrl: 'https://www.ntu.edu.sg/events',

    async fetchCandidates() {
      const candidates = []

      for (let page = 1; page <= maxPages; page += 1) {
        if (page > 1) await sleep(paceMs)

        const url = new URL(NTU_EVENTS_LISTINGS_URL)

        url.searchParams.set('listingKeyword', '')
        url.searchParams.set('categories', 'all')
        url.searchParams.set('interests', 'all')
        url.searchParams.set('audiences', 'all')
        url.searchParams.set('page', String(page))

        const { data } = await fetchJson(url.toString())

        if (
          !data ||
          !Array.isArray(data.items) ||
          !Number.isInteger(data.totalPages) ||
          !Number.isInteger(data.totalItems)
        ) {
          throw new Error('Invalid NTU Events listing response.')
        }

        for (const listing of data.items) {
          candidates.push(extractNtuEventListing(listing) || {})
        }

        const totalPages = Math.max(
          1,
          Math.min(data.totalPages, maxPages),
        )

        if (page >= totalPages) break
      }

      return candidates
    },
  })
}

export const ntuEventsOpportunityAdapter =
  createNtuEventsOpportunityAdapter()
