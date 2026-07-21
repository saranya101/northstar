export function clockValueToMinutes(value, { end = false } = {}) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && (!Number.isFinite(value) || !Number.isInteger(value))) return null
  const text = String(value).trim().toUpperCase().replace(/\s+/g, ' ')
  if (!text) return null
  const match = text.match(/^(\d{1,2})(?::?([0-5]\d))?\s*(AM|PM)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  if (match[3]) {
    if (hour < 1 || hour > 12) return null
    if (hour === 12) hour = 0
    if (match[3] === 'PM') hour += 12
  } else if (hour === 24) {
    return end && minute === 0 ? 1440 : null
  } else if (hour > 23) return null
  const result = hour * 60 + minute
  if (result < 0 || result > (end ? 1440 : 1439) || (end && result < 1)) return null
  return result
}

export function clockRangeToMinutes(value) {
  const normalized = String(value || '').replace(/[–—]/g, '-').trim()
  const parts = normalized.split(/\s*-\s*/)
  if (parts.length !== 2) return null
  let [startText, endText] = parts
  const suffix = endText.match(/\b(AM|PM)\b/i)?.[1]
  if (suffix && !/\b(?:AM|PM)\b/i.test(startText)) startText += ` ${suffix}`
  const startMinutes = clockValueToMinutes(startText)
  const endMinutes = clockValueToMinutes(endText, { end: true })
  return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? { startMinutes, endMinutes } : null
}
