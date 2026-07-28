import { detectDeliveryMode, hasPhysicalVenue } from './timetable-delivery'
import { candidateId, mapClassType } from './timetable-candidate-normaliser'
import { parseWeekExpression } from './week-expression'

const CLASS_PATTERN = /\b(LEC(?:TURE)?(?:\/STU)?|TUT(?:ORIAL)?|SEM(?:INAR)?|LAB(?:ORATORY)?|PRJ|PROJECT|DES|WORKSHOP|FIELDWORK)(?:\s*\/\s*STU)?\s*((?:[A-Z]{1,4}\d+)|LE|\d+)?/i

function normaliseNtuVenue(value) {
  return String(value || '')
    .replace(/\s*([+-])\s*/g, '$1')
    .replace(/(?:\b54-|\$4-)(SR\d+)\b/gi, 'S4-$1')
    .replace(/[^A-Z0-9+]+$/gi, '')
    .trim()
}

export function parseNtuSessionBlock(text, base = {}) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  const classMatch = value.match(CLASS_PATTERN)
  if (!classMatch) return null
  const week = parseWeekExpression(value)
  const deliveryMode = detectDeliveryMode(value)
  const groupLabel = classMatch[2] || 'DEFAULT'
  let remainder = value.slice((classMatch.index || 0) + classMatch[0].length)
    .replace(/;?\s*\b(?:WKK?|WEEK|WEEKS)\s*[\d\s,–—-]+.*$/i, '')
    .replace(/\b(?:MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/ig, '')
    .replace(/\b\d{1,2}:?\d{2}\s*(?:AM|PM)?\s*[-–—]\s*\d{1,2}:?\d{2}\s*(?:AM|PM)?\b/ig, '')
    .replace(/\b\d{4}\s*(?:TO|T0|[-–—])?\s*\d{4}\s*-?\b/ig, '')
    .replace(/\b\d{8,10}\s*-?\b/g, '')
    .trim()
  const codeTokens = new Set((base.codeTokens || []).map(token => String(token || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean))
  if (codeTokens.size) remainder = remainder.split(/\s+/).filter(token => !codeTokens.has(token.toUpperCase().replace(/[^A-Z0-9]/g, ''))).join(' ').trim()
  if (/^NBS\s+ONLINE$/i.test(remainder)) remainder = ''
  else remainder = remainder.replace(/\b(?:ONLINE|ZOOM|MS\s*TEAMS|TEAMS)\b/ig, '').trim()
  const normalisedRemainder = normaliseNtuVenue(remainder.replace(/^;+|;+$/g, ''))
  const venue = deliveryMode === 'TBC' ? 'TBC' : deliveryMode === 'ONLINE' && !normalisedRemainder ? 'ONLINE' : hasPhysicalVenue(normalisedRemainder) ? normalisedRemainder : null
  const warnings = [...(base.warnings || [])]
  if (week.warning) warnings.push(week.warning)
  if (!week.matched && !base.defaultWeekly) warnings.push('Week pattern needs confirmation.')
  if (deliveryMode === 'UNKNOWN') warnings.push('Delivery mode needs confirmation.')
  const startMinutes = base.startMinutes ?? null
  const endMinutes = base.endMinutes ?? null
  const timeAlternatives = Array.isArray(base.timeAlternatives) ? base.timeAlternatives : []
  const timeNeedsReview = warnings.some(warning => /time.*(?:confirmation|conflict|uncertain)|(?:conflict|uncertain).*time/i.test(warning))
  return {
    candidateId: candidateId('session'),
    classType: mapClassType(classMatch[1]),
    groupLabel,
    dayOfWeek: base.dayOfWeek ?? null,
    startMinutes,
    endMinutes,
    timeConfirmed: base.timeConfirmed ?? (Number.isInteger(startMinutes) && Number.isInteger(endMinutes) && endMinutes > startMinutes && !timeNeedsReview && timeAlternatives.length === 0),
    timeAlternatives,
    venue,
    deliveryMode,
    deliveryModeConfirmed: deliveryMode !== 'UNKNOWN',
    recurrence: week.recurrence || 'WEEKLY',
    recurrenceConfirmed: Boolean(week.recurrence) || Boolean(base.defaultWeekly) || /\b(?:WEEKLY|EVERY\s+WEEK)\b/i.test(value),
    weekNumbers: week.weekNumbers,
    confidence: base.confidence ?? (week.warning ? 0.35 : 0.7),
    selected: true,
    warnings
  }
}
