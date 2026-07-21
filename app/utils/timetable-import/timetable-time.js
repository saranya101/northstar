const DAYS = { MON: 'MONDAY', MONDAY: 'MONDAY', TUE: 'TUESDAY', TUES: 'TUESDAY', TUESDAY: 'TUESDAY', WED: 'WEDNESDAY', WEDNESDAY: 'WEDNESDAY', THU: 'THURSDAY', THUR: 'THURSDAY', THURS: 'THURSDAY', THURSDAY: 'THURSDAY', FRI: 'FRIDAY', FRIDAY: 'FRIDAY', SAT: 'SATURDAY', SATURDAY: 'SATURDAY', SUN: 'SUNDAY', SUNDAY: 'SUNDAY' }

export function normalizeDay(value) {
  return DAYS[String(value || '').trim().toUpperCase()] || null
}

export function parseTime(value) {
  const text = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ')
  const match = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minutes = Number(match[2] || 0)
  if (minutes > 59) return null
  if (match[3]) {
    if (hour < 1 || hour > 12) return null
    if (hour === 12) hour = 0
    if (match[3] === 'PM') hour += 12
  } else if (hour > 23) return null
  return hour * 60 + minutes
}

export function parseTimeRange(value) {
  const normalized = String(value || '').replace(/[–—]/g, '-').trim()
  const parts = normalized.split(/\s*-\s*/)
  if (parts.length !== 2) return null
  let [startText, endText] = parts
  const suffix = endText.match(/\b(AM|PM)\b/i)?.[1]
  if (suffix && !/\b(?:AM|PM)\b/i.test(startText)) startText += ` ${suffix}`
  const startMinutes = parseTime(startText)
  const endMinutes = parseTime(endText)
  return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? { startMinutes, endMinutes } : null
}

export function formatMinutes(value) {
  if (!Number.isInteger(value)) return ''
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

