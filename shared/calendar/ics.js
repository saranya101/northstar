import { addDays, addMinutes, dateKey, isAllDayValue, sortCalendarEvents } from './events.js'

const DEFAULT_TIME_ZONE = 'Asia/Singapore'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function escapeIcsText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function byteLength(value) {
  return new TextEncoder().encode(value).length
}

export function foldIcsLine(line, maximumBytes = 75) {
  const text = String(line)
  if (byteLength(text) <= maximumBytes) return text

  const output = []
  let current = ''
  let currentLimit = maximumBytes

  for (const character of text) {
    if (current && byteLength(current + character) > currentLimit) {
      output.push(current)
      current = character
      currentLimit = maximumBytes - 1
    } else {
      current += character
    }
  }

  if (current) output.push(current)
  return output.join('\r\n ')
}

function formatDateOnly(value) {
  const key = dateKey(value)
  return key ? key.replaceAll('-', '') : null
}

function formatLocalDateTime(value) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(String(value || ''))
  if (!match) return null
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] || '00'}`
}

function zonedParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

export function formatIcsDateTime(value, timeZone = DEFAULT_TIME_ZONE) {
  const local = formatLocalDateTime(value)
  if (local) return local
  const parts = zonedParts(value, timeZone)
  if (!parts?.year) return null
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`
}

function formatUtcDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function fnv1a(value) {
  let hash = 0x811c9dc5
  for (const character of String(value)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function stableCalendarUid(event) {
  return `northstar-${fnv1a(event?.id || '')}@northstar.local`
}

function eventDescription(event) {
  return [
    event.description,
    event.moduleCode ? `Module: ${event.moduleCode}${event.moduleTitle ? ` — ${event.moduleTitle}` : ''}.` : null,
    event.weight !== null && event.weight !== undefined ? `Weight: ${event.weight}%.` : null,
    event.sourceLabel ? `Source: ${event.sourceLabel}.` : null,
    event.link ? `Northstar: ${event.link}` : null
  ].filter(Boolean).join('\n')
}

function eventLines(event, stamp, defaultTimeZone) {
  const timeZone = event.timeZone || defaultTimeZone
  const lines = [
    'BEGIN:VEVENT',
    `UID:${stableCalendarUid(event)}`,
    `DTSTAMP:${stamp}`
  ]

  if (event.allDay || isAllDayValue(event.start)) {
    const start = formatDateOnly(event.start)
    const end = formatDateOnly(event.end || addDays(dateKey(event.start), 1))
    lines.push(`DTSTART;VALUE=DATE:${start}`)
    lines.push(`DTEND;VALUE=DATE:${end}`)
  } else {
    const start = formatIcsDateTime(event.start, timeZone)
    const end = formatIcsDateTime(event.end || addMinutes(event.start, 30), timeZone)
    lines.push(`DTSTART;TZID=${timeZone}:${start}`)
    lines.push(`DTEND;TZID=${timeZone}:${end}`)
  }

  lines.push(`SUMMARY:${escapeIcsText(`${event.moduleCode ? `${event.moduleCode} · ` : ''}${event.title || 'Northstar event'}`)}`)
  lines.push(`DESCRIPTION:${escapeIcsText(eventDescription(event))}`)
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  if (event.category) lines.push(`CATEGORIES:${escapeIcsText(event.category)}`)
  lines.push('STATUS:CONFIRMED')
  lines.push('END:VEVENT')
  return lines
}

function singaporeTimeZoneLines() {
  return [
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Singapore',
    'X-LIC-LOCATION:Asia/Singapore',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:+08',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ]
}

export function createIcsCalendar(events = [], {
  calendarName = 'Northstar Academic Calendar',
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date()
} = {}) {
  const stamp = formatUtcDateTime(now)
  if (!stamp) throw new TypeError('A valid calendar generation timestamp is required.')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northstar//Academic Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
    ...singaporeTimeZoneLines()
  ]

  for (const event of sortCalendarEvents(events)) {
    if (!event?.id || !event?.start) continue
    lines.push(...eventLines(event, stamp, timeZone))
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(line => foldIcsLine(line)).join('\r\n')}\r\n`
}

export function safeIcsFileName(value = 'northstar-calendar') {
  const base = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'northstar-calendar'
  return `${base}.ics`
}
