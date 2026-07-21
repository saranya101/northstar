import { normaliseOpportunityTags } from '../../../shared/opportunities/tags'
import { defineOpportunityAdapter } from './contract'

export const VOLUNTEER_GOV_SG_BASE_URL = 'https://www.volunteer.gov.sg'
export const VOLUNTEER_GOV_SG_LISTING_URL = `${VOLUNTEER_GOV_SG_BASE_URL}/volunteer`
export const VOLUNTEER_GOV_SG_SEARCH_URL = `${VOLUNTEER_GOV_SG_BASE_URL}/opportunities/SearchOppotunity`
export const VOLUNTEER_GOV_SG_PAGE_SIZE = 9
export const VOLUNTEER_GOV_SG_MAX_PAGES = 2
export const VOLUNTEER_GOV_SG_REQUEST_PACING_MS = 750

const ALLOWED_HOSTS = new Set(['www.volunteer.gov.sg', 'volunteer.gov.sg'])
const USER_AGENT = 'Northstar Opportunity Scanner/1.0 (public opportunity pages only)'
const MAX_HTML_BYTES = 1_500_000
const REQUEST_TIMEOUT_MS = 15_000

const entities = value => String(value || '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))


const plain = (value, maximum = 5000) => {
  const decoded = entities(String(value || ''))

  const text = decoded
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(
      /<\s*br\s*\/?>|<\/(?:p|div|li|section|article|h[1-6]|tr|td|th)>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.slice(0, maximum).trim() || null
}

const attribute = (tag, name) => entities(
  tag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '',
) || null

function safeVolunteerUrl(value, base = VOLUNTEER_GOV_SG_BASE_URL) {
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function scrubContactInformation(value, maximum) {
  if (!value) return null
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact removed]')
    .replace(/(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b/g, '[contact removed]')
    .slice(0, maximum)
    .trim() || null
}

function dateParts(value) {
  const match = String(value || '').match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null
  return { year, month, day }
}

function timeParts(value, useEnd = false) {
  const text = String(value || '')
  const twelveHourMatches = [...text.matchAll(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi)]
  const twelveHourMatch = useEnd ? twelveHourMatches.at(-1) : twelveHourMatches[0]

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1])
    const minute = Number(twelveHourMatch[2])
    const meridiem = twelveHourMatch[3].toUpperCase()
    if (hour < 1 || hour > 12 || minute > 59) return null
    if (hour === 12) hour = 0
    if (meridiem === 'PM') hour += 12
    return { hour, minute }
  }

  const twentyFourHourMatches = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/g)]
  const twentyFourHourMatch = useEnd ? twentyFourHourMatches.at(-1) : twentyFourHourMatches[0]
  if (!twentyFourHourMatch) return null
  return { hour: Number(twentyFourHourMatch[1]), minute: Number(twentyFourHourMatch[2]) }
}

export function parseSingaporeDateTime(dateValue, timeValue = '', useEnd = false) {
  const date = dateParts(dateValue)
  if (!date) return null
  const time = timeParts(timeValue || dateValue, useEnd) || { hour: useEnd ? 23 : 0, minute: useEnd ? 59 : 0 }
  const local = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00+08:00`
  const parsed = new Date(local)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function firstMatch(value, pattern) {
  return String(value || '').match(pattern)?.[1] || null
}


function findMetaContent(html, names) {
  const wanted = new Set(
    names.map(name => String(name).toLowerCase()),
  )

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const keys = [
      attribute(tag, 'name'),
      attribute(tag, 'property'),
    ]
      .filter(Boolean)
      .map(key => key.toLowerCase())

    if (keys.some(key => wanted.has(key))) {
      return attribute(tag, 'content')
    }
  }

  return null
}

function listingLocation(cardHtml) {
  for (const tag of cardHtml.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []) {
    if (/\/pin\.png/i.test(tag)) return plain(attribute(tag, 'title') || tag, 240)
  }
  return null
}

function listingDateAndTime(cardHtml) {
  const paragraphs = cardHtml.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []
  const dateText = plain(paragraphs.find(item => /calendar\.png/i.test(item)), 80)
  const timeText = plain(paragraphs.find(item => /time\.png/i.test(item)), 80)
  return {
    startAt: parseSingaporeDateTime(dateText, timeText, false),
    endAt: parseSingaporeDateTime(dateText, timeText, true),
  }
}

function cardBlocks(html) {
  const starts = [...String(html || '').matchAll(/<div\b[^>]*class=["'][^"']*\bthumbnail\b[^"']*\bhome-discover-opp\b[^"']*["'][^>]*>/gi)]
  return starts.map((match, index) => {
    const start = match.index
    const end = starts[index + 1]?.index ?? html.length
    return html.slice(start, end)
  })
}

export function extractVolunteerGovSgSearchCards(html) {
  const items = []
  const seen = new Set()

  for (const cardHtml of cardBlocks(html)) {
    const path = firstMatch(cardHtml, /(?:href|location\.href)=["']([^"']*\/volunteer\/opportunity\/details\/\?id=[0-9a-f-]+)["']/i)
    const sourceUrl = safeVolunteerUrl(path)
    if (!sourceUrl) continue

    const externalId = new URL(sourceUrl).searchParams.get('id')
    if (!externalId || seen.has(externalId)) continue

    const titleTag = cardHtml.match(/<span\b[^>]*class=["'][^"']*\blabel-opp-name\b[^"']*["'][^>]*>[\s\S]*?<\/span>/i)?.[0]
    const title = plain(attribute(titleTag, 'title') || titleTag, 180)
    if (!title) continue

    const dates = listingDateAndTime(cardHtml)
    const location = listingLocation(cardHtml)

    seen.add(externalId)
    items.push({
      externalId,
      title,
      organisation: 'Volunteer.gov.sg',
      category: 'VOLUNTEERING',
      description: null,
      sourceUrl,
      applicationUrl: null,
      publishedAt: null,
      deadline: null,
      startAt: dates.startAt,
      endAt: dates.endAt,
      location,
      mode: location ? 'IN_PERSON' : 'UNKNOWN',
      eligibilityText: null,
      requirements: null,
      benefits: null,
      tags: [],
    })
  }

  return items
}

function extractNamedAnchors(html, handlerName) {
  const values = []
  const pattern = new RegExp(`<a\\b[^>]*onclick=["'][^"']*${handlerName}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'gi')
  for (const match of html.matchAll(pattern)) {
    const value = plain(match[1], 80)
    if (value) values.push(value)
  }
  return values
}

function extractCauses(html) {
  const values = []
  for (const tag of html.match(/<a\b[^>]*class=["'][^"']*\bcauses-list\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi) || []) {
    const value = plain(tag, 80)
    if (value) values.push(value)
  }
  return values
}

function extractRequirements(html) {
  const pageText = plain(html, 30_000) || ''
  const start = pageText.search(/\bExpertise:/i)
  let narrative = null
  if (start >= 0) {
    const tail = pageText.slice(start)
    const endMatch = tail.slice(20).search(/\nRequirements\b/i)
    const end = endMatch >= 0 ? 20 + endMatch : Math.min(tail.length, 3000)
    narrative = tail.slice(0, end)
  }

  const detailHtml = firstMatch(
    html,
    /<div\b[^>]*id=["']divOppoDetailsRequirementDetail["'][^>]*>([\s\S]*?)<input\b[^>]*id=["']hdnRequirementsOppoDetail["']/i,
  )
  const detail = plain(detailHtml, 1500)
  const age = pageText.match(/\bAge Range:\s*[^\n]+/i)?.[0] || null
  const eligibilityText = scrubContactInformation(age, 1000)

  const parts = [...new Set([narrative, detail].filter(Boolean))]
  return {
    eligibilityText,
    requirements: scrubContactInformation(parts.join('\n\n'), 3000),
  }
}

function extractShiftRows(html) {
  const table = firstMatch(html, /<table\b[^>]*class=["'][^"']*\boppoRegistration\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)
  if (!table) return []

  const headerRow = table.match(/<tr\b[^>]*>[\s\S]*?<th\b[\s\S]*?<\/tr>/i)?.[0] || ''
  const headers = (headerRow.match(/<th\b[^>]*>[\s\S]*?<\/th>/gi) || []).map(cell => (plain(cell, 100) || '').toLowerCase())
  const indexes = {
    date: headers.findIndex(value => /^date$/.test(value)),
    time: headers.findIndex(value => /^time$/.test(value)),
    location: headers.findIndex(value => /^location$/.test(value)),
    close: headers.findIndex(value => /registration close/.test(value)),
  }

  const rows = []
  for (const rowHtml of table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    if (/<th\b/i.test(rowHtml)) continue
    const cells = (rowHtml.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || []).map(cell => plain(cell, 500) || '')
    if (!cells.length) continue

    const dateText = cells[indexes.date] || cells.find(value => dateParts(value)) || ''
    const timeText = cells[indexes.time] || cells.find(value => /\b(?:AM|PM)\b/i.test(value)) || ''
    const closeText = indexes.close >= 0 ? cells[indexes.close] : ''
    const location = indexes.location >= 0 ? cells[indexes.location] : null

    rows.push({
      startAt: parseSingaporeDateTime(dateText, timeText, false),
      endAt: parseSingaporeDateTime(dateText, timeText, true),
      deadline: parseSingaporeDateTime(closeText, closeText, true),
      location: location || null,
    })
  }
  return rows
}

function earliest(values) {
  const valid = values.filter(Boolean).map(value => new Date(value)).filter(value => !Number.isNaN(value.valueOf()))
  return valid.length ? new Date(Math.min(...valid.map(value => value.valueOf()))).toISOString() : null
}

function latest(values) {
  const valid = values.filter(Boolean).map(value => new Date(value)).filter(value => !Number.isNaN(value.valueOf()))
  return valid.length ? new Date(Math.max(...valid.map(value => value.valueOf()))).toISOString() : null
}

function deliveryMode(title, description, location) {
  const text = [title, description, location].filter(Boolean).join(' ')
  const online = /\b(online|virtual|e-?training|webinar|zoom)\b/i.test(text)
  const physical = Boolean(location && !/\b(online|virtual|remote)\b/i.test(location))
  if (online && physical) return 'HYBRID'
  if (online) return 'ONLINE'
  if (physical) return 'IN_PERSON'
  return 'UNKNOWN'
}

export function extractVolunteerGovSgDetail(html, sourceUrl) {
  if (!html || !safeVolunteerUrl(sourceUrl)) return {}

  const title = plain(
    firstMatch(html, /<h1\b[^>]*class=["'][^"']*\bMainOppertunityID\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      || findMetaContent(html, ['og:title', 'twitter:title']),
    180,
  )

  const organisation = plain(
    firstMatch(html, /\bBy\s*<a\b[^>]*>([\s\S]*?)<\/a>/i),
    180,
  ) || 'Volunteer.gov.sg'

  const descriptionMetaTag =
    html.match(
      /<meta\b(?=[^>]*\bproperty=["']og:description["'])[^>]*>/i,
    )?.[0]
    || html.match(
      /<meta\b(?=[^>]*\bname=["']og:description["'])[^>]*>/i,
    )?.[0]
    || html.match(
      /<meta\b(?=[^>]*\bname=["']twitter:description["'])[^>]*>/i,
    )?.[0]
    || html.match(
      /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,
    )?.[0]

  const description = scrubContactInformation(
    plain(attribute(descriptionMetaTag, 'content'), 5000),
    5000,
  )

  const causes = extractCauses(html)
  const skills = extractNamedAnchors(html, 'setSkillsfilter')
  const locations = extractNamedAnchors(html, 'setLocationfilter')
  const shifts = extractShiftRows(html)
  const hiddenStart = attribute(
    html.match(/<input\b[^>]*id=["']hdOppoStartDateTime["'][^>]*>/i)?.[0],
    'value',
  )

  const startAt = earliest([
    ...shifts.map(shift => shift.startAt),
    parseSingaporeDateTime(hiddenStart, hiddenStart, false),
  ])
  const endAt = latest(shifts.map(shift => shift.endAt))
  const deadline = earliest(shifts.map(shift => shift.deadline))
  const location = locations[0] || shifts.find(shift => shift.location)?.location || null
  const requirements = extractRequirements(html)

  return {
    title,
    organisation,
    description,
    deadline,
    startAt,
    endAt,
    location,
    mode: deliveryMode(title, description, location),
    eligibilityText: requirements.eligibilityText,
    requirements: requirements.requirements,
    benefits: null,
    tags: normaliseOpportunityTags([...causes, ...skills]),
  }
}

function mergeCandidate(listing, detail) {
  const result = { ...listing }
  for (const key of [
    'title',
    'organisation',
    'description',
    'deadline',
    'startAt',
    'endAt',
    'location',
    'mode',
    'eligibilityText',
    'requirements',
    'benefits',
    'tags',
  ]) {
    const value = detail[key]
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) result[key] = value
  }
  return result
}

function updateCookieJar(jar, response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []

  for (const header of setCookies) {
    const pair = header.split(';', 1)[0]
    const separator = pair.indexOf('=')
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function readBoundedHtml(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error('Volunteer.gov.sg returned an unsupported response type.')

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_HTML_BYTES) throw new Error('Volunteer.gov.sg response was too large.')

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_HTML_BYTES) throw new Error('Volunteer.gov.sg response was too large.')
  return buffer.toString('utf8')
}

async function fixedHostFetch(input, options = {}) {
  let url = new URL(input)
  const jar = options.jar || new Map()

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) {
      throw new Error('Volunteer.gov.sg redirected outside its approved public host.')
    }

    const headers = {
      accept: 'text/html, */*',
      'user-agent': USER_AGENT,
      ...options.headers,
    }
    const cookies = cookieHeader(jar)
    if (cookies) headers.cookie = cookies

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    updateCookieJar(jar, response)

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Volunteer.gov.sg returned an invalid redirect.')
      url = new URL(location, url)
      continue
    }

    if (!response.ok) throw new Error(`Volunteer.gov.sg returned HTTP ${response.status}.`)
    return { html: await readBoundedHtml(response), jar, url: url.toString() }
  }

  throw new Error('Volunteer.gov.sg redirected too many times.')
}

function extractVerificationTokens(html) {
  const values = []
  for (const tag of html.match(/<input\b[^>]*name=["']__RequestVerificationToken["'][^>]*>/gi) || []) {
    const value = attribute(tag, 'value')
    if (value && !values.includes(value)) values.push(value)
  }
  return values
}

function searchBody(token, page, pageSize) {
  return new URLSearchParams({
    'mySearch[Homepage]': 'main',
    'mySearch[CausesSearchText]': '',
    'mySearch[AgencySearchText]': '',
    'mySearch[SkillSearchText]': '',
    'mySearch[OpportunitySlotSearchText]': 'HaveVacancies',
    'mySearch[opportunityStatusSearchText]': '',
    'mySearch[SearchFromDate]': '',
    'mySearch[SearchToDate]': '',
    'mySearch[SearchKeyword]': '',
    'mySearch[Selecteddate]': '',
    'mySearch[PageNo]': String(page),
    'mySearch[PageSize]': String(pageSize),
    'mySearch[Assistme]': '',
    'mySearch[LoadMore]': 'True',
    'mySearch[__RequestVerificationToken]': token,
    SearchByssistMe: '',
    __RequestVerificationToken: token,
  })
}

export async function createVolunteerGovSgPublicSession() {
  const jar = new Map()
  const listing = await fixedHostFetch(VOLUNTEER_GOV_SG_LISTING_URL, { jar })
  const tokens = extractVerificationTokens(listing.html)
  if (!tokens.length) throw new Error('Volunteer.gov.sg did not provide a public request-verification token.')

  let selectedToken = null

  return {
    async search(page, pageSize = VOLUNTEER_GOV_SG_PAGE_SIZE) {
      const candidates = selectedToken ? [selectedToken] : tokens
      for (const token of candidates) {
        const body = searchBody(token, page, pageSize)
        const response = await fixedHostFetch(VOLUNTEER_GOV_SG_SEARCH_URL, {
          jar,
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            origin: VOLUNTEER_GOV_SG_BASE_URL,
            referer: VOLUNTEER_GOV_SG_LISTING_URL,
            'x-requested-with': 'XMLHttpRequest',
          },
          body,
        })
        if (selectedToken || extractVolunteerGovSgSearchCards(response.html).length || /No items to display/i.test(response.html)) {
          selectedToken = token
          return response.html
        }
      }
      throw new Error('Volunteer.gov.sg rejected the public search request.')
    },
  }
}

async function fetchVolunteerDetail(sourceUrl) {
  const result = await fixedHostFetch(sourceUrl)
  return result.html
}

export function createVolunteerGovSgOpportunityAdapter(options = {}) {
  const createSession = options.createSession || createVolunteerGovSgPublicSession
  const fetchDetail = options.fetchDetail || fetchVolunteerDetail
  const maxPages = Math.max(1, Math.min(options.maxPages || VOLUNTEER_GOV_SG_MAX_PAGES, VOLUNTEER_GOV_SG_MAX_PAGES))
  const pageSize = Math.max(1, Math.min(options.pageSize || VOLUNTEER_GOV_SG_PAGE_SIZE, VOLUNTEER_GOV_SG_PAGE_SIZE))
  const paceMs = Math.max(VOLUNTEER_GOV_SG_REQUEST_PACING_MS, options.paceMs ?? VOLUNTEER_GOV_SG_REQUEST_PACING_MS)
  const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))

  return defineOpportunityAdapter({
    key: 'volunteer-gov-sg',
    name: 'Volunteer.gov.sg',
    slug: 'volunteer-gov-sg',
    baseUrl: VOLUNTEER_GOV_SG_LISTING_URL,
    async fetchCandidates() {
      const session = await createSession()
      const candidates = []
      const seen = new Set()

      for (let page = 1; page <= maxPages; page += 1) {
        if (page > 1) await sleep(paceMs)
        const html = await session.search(page, pageSize)
        const listings = extractVolunteerGovSgSearchCards(html)
        let newOnPage = 0

        for (const listing of listings) {
          if (seen.has(listing.externalId)) continue
          seen.add(listing.externalId)
          newOnPage += 1

          await sleep(paceMs)
          try {
            const detailHtml = await fetchDetail(listing.sourceUrl)
            candidates.push(mergeCandidate(listing, extractVolunteerGovSgDetail(detailHtml, listing.sourceUrl)))
          } catch {
            candidates.push(listing)
          }
        }

        if (!listings.length || !newOnPage || listings.length < pageSize) break
      }

      return candidates
    },
  })
}

export const volunteerGovSgOpportunityAdapter = createVolunteerGovSgOpportunityAdapter()
