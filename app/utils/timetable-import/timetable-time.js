const DAYS = { MON: 'MONDAY', MONDAY: 'MONDAY', TUE: 'TUESDAY', TUES: 'TUESDAY', TUESDAY: 'TUESDAY', WED: 'WEDNESDAY', WEDNESDAY: 'WEDNESDAY', THU: 'THURSDAY', THUR: 'THURSDAY', THURS: 'THURSDAY', THURSDAY: 'THURSDAY', FRI: 'FRIDAY', FRIDAY: 'FRIDAY', SAT: 'SATURDAY', SATURDAY: 'SATURDAY', SUN: 'SUNDAY', SUNDAY: 'SUNDAY' }

import { clockRangeToMinutes, clockValueToMinutes } from '#shared/utils/clock-time'

export function normalizeDay(value) {
  return DAYS[String(value || '').trim().toUpperCase()] || null
}

export function parseTime(value, options) {
  return clockValueToMinutes(value, options)
}

export function parseTimeRange(value) {
  return clockRangeToMinutes(value)
}

export { clockValueToMinutes }

export function formatMinutes(value) {
  if (!Number.isInteger(value)) return ''
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
