import {
  fetchPublicHtml,
  fetchPublicJson,
} from '../../services/opportunity-link-fetcher'
import { defineOpportunityAdapter } from './contract'
import { normaliseOpportunityTags } from '#shared/opportunities/tags'

export const NTU_EVENTS_LISTINGS_URL =
  'https://www.ntu.edu.sg/events/GetEvents/'

export const NTU_EVENTS_MAX_PAGES = 20
export const NTU_EVENTS_REQUEST_PACING_MS = 300
export const NTU_SEARCH_URL =
  'https://www.ntu.edu.sg/search-results/Search/'
export const NTU_SEARCH_MAX_DETAILS_PER_QUERY = 3
export const NTU_SEARCH_QUERIES = Object.freeze([
  { key: 'ntu-search-hackathons', query: 'hackathon' },
  { key: 'ntu-search-case-competitions', query: 'case competition' },
  { key: 'ntu-search-innovation-challenges', query: 'innovation challenge' },
  { key: 'ntu-search-physics-challenges', query: 'physics challenge' },
  { key: 'ntu-search-workshops', query: 'student workshop' },
  { key: 'ntu-search-research', query: 'research programme applications' },
  { key: 'ntu-search-entrepreneurship', query: 'entrepreneurship programme' },
  { key: 'ntu-search-leadership', query: 'student leadership programme' },
])

export const NTU_OFFICIAL_PAGE_SOURCES = Object.freeze([
  {
    key: 'ntu-entrepreneurship-oep',
    url: 'https://www.ntu.edu.sg/ntupreneur/programmes/undergraduate-programmes/OEP',
    organisation: 'NTU Entrepreneurship Academy',
  },
  {
    key: 'ntu-wkwsci-graduate-research',
    url: 'https://www.ntu.edu.sg/education/graduate-programme/master-of-communication-studies',
    organisation: 'Wee Kim Wee School of Communication and Information',
  },
])

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

const attribute = (tag, name) =>
  entities(
    tag?.match(
      new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'),
    )?.[1] || '',
  ) || null

const absolutePublicUrl = (value, base) => {
  try {
    const url = new URL(value, base)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(url.pathname)
    ) {
      return null
    }
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

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
  const title = String(listing?.title || '')
  const text = [
    listing?.tag,
    listing?.title,
    listing?.description,
    listing?.content,
  ]
    .filter(Boolean)
    .join(' ')

  if (/\bhack(?:athon|s)?\b/i.test(title)) return 'HACKATHON'
  if (/\b(competition|challenge|contest)\b/i.test(title)) return 'COMPETITION'
  if (/\b(research|researcher|research programme)\b/i.test(title)) return 'RESEARCH'
  if (/\b(scholarship|fellowship|grant|subsid)\w*\b/i.test(title)) return 'SCHOLARSHIP'
  if (/\b(volunteer|community service)\w*\b/i.test(title)) return 'VOLUNTEERING'
  if (/\b(startup|entrepreneur\w*|incubator|accelerator|venture)\b/i.test(title)) {
    return 'ENTREPRENEURSHIP'
  }
  if (/\b(leadership|leader development)\b/i.test(title)) return 'LEADERSHIP'
  if (/\b(mentor|mentorship)\w*\b/i.test(title)) return 'MENTORSHIP'
  if (/\b(services|admissions)\b/i.test(title)) return 'OTHER'

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

  if (/\b(scholarship|fellowship|funded programme)\b/i.test(text)) {
    return 'SCHOLARSHIP'
  }

  if (/\b(mentor|mentorship)\w*\b/i.test(text)) {
    return 'MENTORSHIP'
  }

  if (/\b(volunteer|community service|community engagement)\w*\b/i.test(text)) {
    return 'VOLUNTEERING'
  }

  if (/\b(leadership|committee leader)\b/i.test(text)) {
    return 'LEADERSHIP'
  }

  if (/\b(club|student activit(?:y|ies)|student organisation)\b/i.test(text)) {
    return 'CLUB'
  }

  if (
    /\b(startup|entrepreneur\w*|founder|incubator|accelerator|venture)\b/i.test(
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

const NTU_UNIT_PATHS = [
  ['/computing/', 'College of Computing and Data Science'],
  ['/business/', 'Nanyang Business School'],
  ['/ceit/', 'Centre of Excellence International Trading'],
  ['/cee/', 'School of Civil and Environmental Engineering'],
  ['/eee/', 'School of Electrical and Electronic Engineering'],
  ['/mae/', 'School of Mechanical and Aerospace Engineering'],
  ['/mse/', 'School of Materials Science and Engineering'],
  ['/spms/', 'School of Physical and Mathematical Sciences'],
  ['/sss/', 'School of Social Sciences'],
  ['/soh/', 'School of Humanities'],
  ['/wkwsci/', 'Wee Kim Wee School of Communication and Information'],
  ['/adm/', 'School of Art, Design and Media'],
  ['/ase/', 'Asian School of the Environment'],
  ['/medicine/', 'Lee Kong Chian School of Medicine'],
  ['/nie/', 'National Institute of Education'],
  ['/ntupreneur/', 'NTU Entrepreneurship Academy'],
  ['/innovates/', 'NTUitive'],
  ['/graduate-college/', 'NTU Graduate College'],
]

function organisationFromNtuUrl(sourceUrl) {
  const path = new URL(sourceUrl).pathname.toLowerCase()
  return NTU_UNIT_PATHS.find(([prefix]) => path.includes(prefix))?.[1] ||
    'Nanyang Technological University'
}

function actionableSearchResult(item) {
  const text = `${item?.title || ''} ${item?.tag || ''} ${item?.description || ''}`
  return /\b(hackathon|competition|challenge|workshop|bootcamp|masterclass|conference|seminar|lecture|talk|networking|career fair|research|entrepreneur|startup|venture|leadership|mentor|scholarship|fellowship|volunteer|certification)\w*\b/i.test(text)
}

function plausiblyCurrentNtuUrl(sourceUrl, now) {
  const path = new URL(sourceUrl).pathname
  const dated = path.match(
    /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/,
  )
  if (dated) {
    const localDate = new Date(
      `${dated[1]}-${dated[2].padStart(2, '0')}-${dated[3].padStart(2, '0')}T23:59:59+08:00`,
    )
    return !Number.isNaN(localDate.valueOf()) && localDate >= now
  }
  const years = [...path.matchAll(/\b(20\d{2})\b/g)]
    .map(match => Number(match[1]))
  return years.length === 0 ||
    years.some(year => year >= now.getUTCFullYear())
}

export function extractNtuSearchResultUrls(data, { now = new Date() } = {}) {
  if (
    !data ||
    !Array.isArray(data.items) ||
    !Number.isInteger(data.totalPages) ||
    !Number.isInteger(data.totalItems)
  ) {
    throw new Error('Invalid NTU search response.')
  }
  const seen = new Set()
  const results = []
  for (const item of data.items) {
    const rawSourceUrl = publicNtuUrl(item?.url, NTU_SEARCH_URL)
    let sourceUrl = rawSourceUrl
    if (sourceUrl) {
      const canonical = new URL(sourceUrl)
      canonical.search = ''
      sourceUrl = canonical.toString()
    }
    const path = sourceUrl ? new URL(sourceUrl).pathname.toLowerCase() : ''
    if (
      !sourceUrl ||
      seen.has(sourceUrl) ||
      !actionableSearchResult(item) ||
      !plausiblyCurrentNtuUrl(sourceUrl, now) ||
      /\.(?:pdf|docx?|xlsx?|pptx?)(?:[?#]|$)/i.test(sourceUrl) ||
      /\/(?:news-events\/news|news)(?:\/|$)/i.test(path) ||
      /\/home\/?$/i.test(path) ||
      /^(education|admissions|home|programmes?|news|events?)$/i.test(
        String(item?.title || '').trim(),
      )
    ) continue
    seen.add(sourceUrl)
    results.push({
      url: sourceUrl,
      organisation: organisationFromNtuUrl(sourceUrl),
      discovered: true,
    })
    if (results.length >= NTU_SEARCH_MAX_DETAILS_PER_QUERY) break
  }
  return results
}

const MONTHS = new Map([
  ['jan', 0], ['january', 0], ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2], ['apr', 3], ['april', 3],
  ['may', 4], ['jun', 5], ['june', 5], ['jul', 6],
  ['july', 6], ['aug', 7], ['august', 7], ['sep', 8],
  ['sept', 8], ['september', 8], ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10], ['dec', 11], ['december', 11],
])

function singaporeDate(value, endOfDay = false) {
  const match = String(value || '').match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})(?:\s*,?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM))?/i,
  )
  if (!match) return null
  const month = MONTHS.get(match[2].toLowerCase())
  if (month === undefined) return null
  let hour = match[4] ? Number(match[4]) : endOfDay ? 23 : 0
  const minute = match[5] ? Number(match[5]) : endOfDay ? 59 : 0
  if (match[6]) {
    if (hour === 12) hour = 0
    if (match[6].toUpperCase() === 'PM') hour += 12
  }
  const local = `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${endOfDay && !match[4] ? '59' : '00'}+08:00`
  const date = new Date(local)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function firstMeta(html, names) {
  const wanted = new Set(names.map(value => value.toLowerCase()))
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const key = (
      attribute(tag, 'name') ||
      attribute(tag, 'property') ||
      ''
    ).toLowerCase()
    if (wanted.has(key)) return attribute(tag, 'content')
  }
  return null
}

function structuredData(html) {
  for (const match of String(html || '').matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = JSON.parse(entities(match[1]))
      const items = Array.isArray(value?.['@graph'])
        ? value['@graph']
        : [value]
      const item = items.find(entry =>
        ['Event', 'EducationalOccupationalProgram'].includes(entry?.['@type']),
      )
      if (item) return item
    } catch {
      // A malformed structured-data block must not make the page unusable.
    }
  }
  return {}
}

function headingTitle(html) {
  const headings = String(html || '').match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []
  return headings
    .map(value => plain(value, 180))
    .find(value =>
      value &&
      !/^(general questions|frequently asked questions|faq|contact us)$/i.test(value),
    ) || null
}

function labelledDate(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const parsed = singaporeDate(match?.[1], true)
    if (parsed) return parsed
  }
  return null
}

function pageApplicationUrl(html, sourceUrl) {
  for (const tag of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const label = plain(tag, 100)
    if (!/\b(apply|register|registration)\b/i.test(label || '')) continue
    const url = absolutePublicUrl(attribute(tag, 'href'), sourceUrl)
    if (url) return url
  }
  return null
}

export function extractNtuOfficialPage(
  html,
  source,
  { now = new Date() } = {},
) {
  if (!html || !source?.url || !source?.organisation) return null
  const sourceUrl = publicNtuUrl(source.url)
  if (!sourceUrl) return null

  const data = structuredData(html)
  const pageText = plain(html, 40_000)
  const title =
    plain(data.name, 180) ||
    plain(firstMeta(html, ['og:title']), 180) ||
    headingTitle(html)
  const description =
    plain(data.description, 5000) ||
    plain(firstMeta(html, ['description', 'og:description']), 5000)

  if (!title || !pageText) return null

  const deadline = labelledDate(pageText, [
    /(?:applications?|registration)\s+(?:close|closes|deadline|ends?|to|by)[^.\n]{0,60}?(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}(?:\s*,?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)/i,
    /(?:apply|register)\s+by[^.\n]{0,20}?(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}(?:\s*,?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)/i,
    /Application Window[\s\S]{0,100}?\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}\s+(?:to|[-–—])\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})/i,
    /\bIt closes on\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}(?:\s*,?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)/i,
    /\bapply from[\s\S]{0,50}?\d{1,2}\s+[A-Za-z]{3,9}\s+(?:to|[-–—])\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})/i,
  ])

  let startAt = data.startDate
    ? new Date(data.startDate).toISOString()
    : null
  let endAt = data.endDate
    ? new Date(data.endDate).toISOString()
    : null

  const window = pageText.match(
    /(?:programme dates?|research period|date)\s*[:|]?\s*(\d{1,2}\s+[A-Za-z]{3,9}(?:\s+20\d{2})?)\s+(?:to|[-–—])\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})/i,
  )
  if (!startAt && window) {
    const endYear = window[2].match(/20\d{2}/)?.[0]
    startAt = singaporeDate(
      /20\d{2}/.test(window[1])
        ? window[1]
        : `${window[1]} ${endYear}`,
    )
    endAt = singaporeDate(window[2], true)
  }

  if (!startAt && source.discovered) {
    const pathDate = new URL(sourceUrl).pathname.match(
      /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/,
    )
    if (pathDate) {
      startAt = parseNtuEventTimestamp(
        `${pathDate[1]}${pathDate[2].padStart(2, '0')}${pathDate[3].padStart(2, '0')}T000000`,
      )
    }
  }

  if (
    (deadline && new Date(deadline) < now) &&
    (!endAt || new Date(endAt) < now)
  ) {
    return null
  }
  if (!deadline && endAt && new Date(endAt) < now) return null
  if (
    source.discovered &&
    !deadline &&
    !startAt &&
    !endAt
  ) {
    const actionableTitle =
      /\b(hackathon|competition|challenge|workshop|bootcamp|masterclass|conference|seminar|lecture|talk|networking|career fair|research|entrepreneur\w*|startup|venture|programme|program|leadership|mentor\w*|scholarship|fellowship|volunteer\w*|certification)\b/i.test(title)
    const openSignal =
      /\b(applications?|registration)\s+(?:is\s+)?(?:now\s+)?open\b|\bapply now\b|\bregister now\b/i.test(pageText)
    if (!actionableTitle || !openSignal) return null
  }

  const location =
    plain(data.location?.name, 240) ||
    plain(pageText.match(/\bVenue\s*:\s*([^\n]{2,240})/i)?.[1], 240)
  const place = modeAndLocation({
    location,
    title,
    description,
    content: pageText,
  })

  return {
    externalId: source.key || externalIdFromUrl(sourceUrl),
    title,
    organisation: source.organisation,
    category: classifyNtuEvent({
      title,
      description,
      content: pageText,
    }),
    description,
    sourceUrl,
    applicationUrl: pageApplicationUrl(html, sourceUrl),
    publishedAt: null,
    deadline,
    startAt,
    endAt,
    location: place.location,
    mode: place.mode,
    commitment: plain(
      pageText.match(/\b(?:duration|commitment)\s*[:|]\s*([^\n]{2,300})/i)?.[1],
      300,
    ),
    eligibilityText: plain(
      pageText.match(/\bEligibility\s*[:|]?\s*([^\n]{2,1500})/i)?.[1],
      1500,
    ),
    requirements: plain(
      pageText.match(/\b(?:Requirements?|Application Materials)\s*[:|]?\s*([^\n]{2,1500})/i)?.[1],
      1500,
    ),
    benefits: plain(
      pageText.match(/\b(?:Benefits?|Prizes?|Funding)\s*[:|]?\s*([^\n]{2,1500})/i)?.[1],
      1500,
    ),
    tags: normaliseOpportunityTags(extractTags({
      title,
      description,
      content: pageText,
    })),
  }
}

function candidateKey(candidate) {
  try {
    const url = new URL(candidate.sourceUrl)
    url.hash = ''
    return `url:${url.toString().toLowerCase()}`
  } catch {
    return [
      candidate.title,
      candidate.organisation,
      candidate.startAt,
      candidate.deadline,
    ]
      .map(value => String(value || '').trim().toLowerCase())
      .join('|')
  }
}

function mergeNtuCandidates(left, right) {
  const preferred =
    Object.values(right).filter(Boolean).length >
    Object.values(left).filter(Boolean).length
      ? { ...right }
      : { ...left }
  const other = preferred.sourceUrl === right.sourceUrl ? left : right
  for (const key of Object.keys(preferred)) {
    if (!preferred[key] && other[key]) preferred[key] = other[key]
  }
  preferred.tags = normaliseOpportunityTags([
    ...(left.tags || []),
    ...(right.tags || []),
  ])
  return preferred
}

export function deduplicateNtuCandidates(candidates) {
  const byKey = new Map()
  for (const candidate of candidates.filter(Boolean)) {
    const key = candidateKey(candidate)
    byKey.set(
      key,
      byKey.has(key)
        ? mergeNtuCandidates(byKey.get(key), candidate)
        : candidate,
    )
  }
  return [...byKey.values()]
}

export async function aggregateNtuSubSources(subSources) {
  const candidates = []
  const diagnostics = []
  for (const source of subSources) {
    try {
      const result = await source.fetch()
      if (!Array.isArray(result)) throw new Error('Invalid sub-source result.')
      candidates.push(...result)
      diagnostics.push({
        key: source.key,
        status: 'SUCCEEDED',
        count: result.length,
      })
    } catch {
      diagnostics.push({
        key: source.key,
        status: 'FAILED',
        count: 0,
      })
    }
  }
  if (!diagnostics.some(item => item.status === 'SUCCEEDED')) {
    throw new Error('All NTU public sub-sources were unavailable.')
  }
  return {
    candidates: deduplicateNtuCandidates(candidates),
    diagnostics,
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
  const fetchHtml = options.fetchHtml || fetchPublicHtml
  const officialPages = options.officialPages || NTU_OFFICIAL_PAGE_SOURCES
  const searchQueries = options.searchQueries || NTU_SEARCH_QUERIES
  const now = options.now || (() => new Date())

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
      const subSources = [{
        key: 'ntu-central',
        async fetch() {
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
            if (page >= Math.max(1, Math.min(data.totalPages, maxPages))) break
          }
          return candidates
        },
      }]

      for (const source of officialPages) {
        subSources.push({
          key: source.key,
          async fetch() {
            await sleep(paceMs)
            const { html } = await fetchHtml(source.url)
            const candidate = extractNtuOfficialPage(html, source, {
              now: now(),
            })
            return candidate ? [candidate] : []
          },
        })
      }

      for (const definition of searchQueries) {
        subSources.push({
          key: definition.key,
          async fetch() {
            await sleep(paceMs)
            const url = new URL(NTU_SEARCH_URL)
            url.searchParams.set('q', definition.query)
            url.searchParams.set('page', '1')
            const { data } = await fetchJson(url.toString())
            const sources = extractNtuSearchResultUrls(data, {
              now: now(),
            })
            const candidates = []
            for (const source of sources) {
              await sleep(paceMs)
              try {
                const { html } = await fetchHtml(source.url)
                const candidate = extractNtuOfficialPage(html, source, {
                  now: now(),
                })
                if (candidate) candidates.push(candidate)
              } catch {
                // One changed or unavailable result must not fail the query.
              }
            }
            return candidates
          },
        })
      }

      const result = await aggregateNtuSubSources(subSources)
      return result.candidates
    },
  })
}

export const ntuEventsOpportunityAdapter =
  createNtuEventsOpportunityAdapter()
