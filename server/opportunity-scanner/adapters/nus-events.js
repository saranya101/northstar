import { normaliseOpportunityTags } from '#shared/opportunities/tags'
import { fetchPublicCalendar } from '../../services/opportunity-link-fetcher'
import { defineOpportunityAdapter } from './contract'

export const NUS_COMPUTING_CALENDAR_URL =
  'https://events.comp.nus.edu.sg/calfeed/calendar-master-ical.ics'

const unescapeIcs = value => String(value || '')
  .replace(/\\n/gi, '\n')
  .replace(/\\,/g, ',')
  .replace(/\\;/g, ';')
  .replace(/\\\\/g, '\\')
  .trim()

function publicNusUrl(value, base = NUS_COMPUTING_CALENDAR_URL) {
  try {
    const url = new URL(value, base)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !/(^|\.)nus\.edu\.sg$/i.test(url.hostname) ||
      /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(url.pathname)
    ) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function calendarDate(value, { endOfDay = false } = {}) {
  const text = String(value || '').trim()
  const match = text.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/,
  )
  if (!match) return null
  const dateOnly = !match[4]
  const hour = dateOnly && endOfDay ? 23 : Number(match[4] || 0)
  const minute = dateOnly && endOfDay ? 59 : Number(match[5] || 0)
  const second = dateOnly && endOfDay ? 59 : Number(match[6] || 0)
  const suffix = match[7] ? 'Z' : '+08:00'
  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${suffix}`,
  )
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function classifyNusEvent(text) {
  if (/\bhack(?:athon|s)?\b/i.test(text)) return 'HACKATHON'
  if (/\b(competition|challenge|contest)\b/i.test(text)) return 'COMPETITION'
  if (/\b(workshop|bootcamp|masterclass|training)\b/i.test(text)) return 'WORKSHOP'
  if (/\b(networking|career fair|recruitment fair)\b/i.test(text)) return 'NETWORKING'
  if (/\b(research|research programme)\b/i.test(text)) return 'RESEARCH'
  if (/\b(startup|entrepreneur|venture|incubator|accelerator)\w*\b/i.test(text)) return 'ENTREPRENEURSHIP'
  if (/\b(leadership|leader development)\b/i.test(text)) return 'LEADERSHIP'
  if (/\b(volunteer|community service)\w*\b/i.test(text)) return 'VOLUNTEERING'
  if (/\b(scholarship|fellowship)\b/i.test(text)) return 'SCHOLARSHIP'
  if (/\b(mentor|mentorship)\w*\b/i.test(text)) return 'MENTORSHIP'
  if (/\b(seminar|lecture|talk|conference|symposium|forum|webinar)\b/i.test(text)) return 'TALK'
  return 'OTHER'
}

function tagsFor(text) {
  const rules = [
    ['AI', /\b(ai|artificial intelligence)\b/i],
    ['Machine Learning', /\b(machine learning|ml)\b/i],
    ['Data Science', /\bdata science\b/i],
    ['Software Engineering', /\bsoftware engineering\b/i],
    ['Cybersecurity', /\b(cybersecurity|cyber security)\b/i],
    ['Career', /\b(career|recruit|internship|employment)\w*\b/i],
    ['Research', /\bresearch\b/i],
    ['Entrepreneurship', /\b(startup|entrepreneur|venture)\w*\b/i],
    ['Leadership', /\bleader(?:ship)?\b/i],
    ['Sustainability', /\b(sustainab|climate|environment)\w*\b/i],
  ]
  return normaliseOpportunityTags(
    rules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag),
  )
}

function fieldsFromEvent(block) {
  const fields = new Map()
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([^:;]+)(?:;[^:]*)?:(.*)$/)
    if (match && !fields.has(match[1])) fields.set(match[1], match[2])
  }
  return fields
}

export function parseNusCalendar(
  calendar,
  { now = new Date() } = {},
) {
  const unfolded = String(calendar || '').replace(/\r?\n[ \t]/g, '')
  const candidates = []
  for (const match of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)) {
    const fields = fieldsFromEvent(match[1])
    const title = unescapeIcs(fields.get('SUMMARY'))
    const sourceUrl = publicNusUrl(
      fields.get('URL') ||
      unescapeIcs(fields.get('DESCRIPTION')).match(/https:\/\/[^\s]+/i)?.[0],
    )
    const startAt = calendarDate(fields.get('DTSTART'))
    const endAt = calendarDate(fields.get('DTEND'), { endOfDay: true })
    const externalId = unescapeIcs(fields.get('UID'))
    if (!title || !sourceUrl || !externalId || !startAt) {
      candidates.push({})
      continue
    }
    if (endAt && new Date(endAt) < now) continue
    const description = unescapeIcs(fields.get('DESCRIPTION')) || null
    const location = unescapeIcs(fields.get('LOCATION')) || null
    const combined = `${title} ${description || ''} ${location || ''}`
    const online = /\b(online|virtual|zoom|teams|webinar)\b/i.test(combined)
    const inPerson = Boolean(location) && !/^(online|virtual|zoom|teams)$/i.test(location)
    candidates.push({
      externalId,
      title,
      organisation: 'NUS School of Computing',
      category: classifyNusEvent(combined),
      description,
      sourceUrl,
      applicationUrl: null,
      publishedAt: calendarDate(fields.get('DTSTAMP')),
      deadline: null,
      startAt,
      endAt,
      location: inPerson ? location : null,
      mode: online && inPerson ? 'HYBRID' : online ? 'ONLINE' : inPerson ? 'IN_PERSON' : 'UNKNOWN',
      commitment: null,
      eligibilityText: null,
      requirements: null,
      benefits: null,
      tags: tagsFor(combined),
    })
  }
  if (!/^BEGIN:VCALENDAR\b/m.test(unfolded)) {
    throw new Error('Invalid NUS calendar response.')
  }
  return candidates
}

export function createNusEventsOpportunityAdapter(options = {}) {
  const fetchCalendar = options.fetchCalendar || fetchPublicCalendar
  const now = options.now || (() => new Date())
  return defineOpportunityAdapter({
    key: 'nus-events',
    name: 'NUS Events',
    slug: 'nus-events',
    baseUrl: 'https://events.comp.nus.edu.sg/',
    async fetchCandidates() {
      const { text } = await fetchCalendar(NUS_COMPUTING_CALENDAR_URL)
      return parseNusCalendar(text, { now: now() })
    },
  })
}

export const nusEventsOpportunityAdapter =
  createNusEventsOpportunityAdapter()
