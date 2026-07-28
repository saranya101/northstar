import { candidateId } from './timetable-candidate-normaliser'
import { hasPhysicalVenue } from './timetable-delivery'
import { parseNtuSessionBlock } from './ntu-session-block-parser'
import { matchAllowedCode } from './ntu-registered-table-parser'
import { normalizeDay, parseTime } from './timetable-time'
import { findModuleCodes } from './timetable-text-parser'

function centre(item) { return { x: (item.bbox.x0 + item.bbox.x1) / 2, y: (item.bbox.y0 + item.bbox.y1) / 2 } }
function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null }
function clean(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }

function inferredRowHeight(times) {
  const values = []
  const sorted = [...times].sort((left, right) => left.minutes - right.minutes)
  for (let index = 1; index < sorted.length; index += 1) {
    const minuteDifference = sorted[index].minutes - sorted[index - 1].minutes
    const pixelDifference = Math.abs(sorted[index].y - sorted[index - 1].y)
    if (minuteDifference >= 30 && minuteDifference <= 120 && pixelDifference > 0) values.push(pixelDifference / (minuteDifference / 30))
  }
  return median(values)
}

function minutesAtY(y, times, rowHeight) {
  if (!times.length || !rowHeight) return null
  const nearest = times.reduce((best, time) => !best || Math.abs(time.y - y) < Math.abs(best.y - y) ? time : best, null)
  const value = nearest.minutes + Math.round((y - nearest.y) / rowHeight) * 30
  return value >= 480 && value <= 1410 ? value : null
}

export function explicitTimeRange(text) {
  const value = String(text || '')
  const candidates = [
    ...value.matchAll(/(?:^|\D)(\d{4})\s*(?:TO|T0|[-–—])\s*(\d{4})(?=\D|$)/gi),
    ...value.matchAll(/(?:^|\D)(\d{4})(\d{4})(?=\D|$)/g)
  ]
  for (const candidate of candidates) {
    const startText = candidate[1]
    const endText = candidate[2]
    const startMinutes = parseTime(startText)
    const endMinutes = parseTime(endText, { end: true })
    if (startMinutes !== null && endMinutes !== null && startMinutes >= 480 && endMinutes <= 1410 && endMinutes > startMinutes) return { startMinutes, endMinutes }
  }
  return null
}

function textFromWords(words) {
  const lines = []
  for (const word of [...words].sort((left, right) => centre(left).y - centre(right).y || left.bbox.x0 - right.bbox.x0)) {
    const y = centre(word).y
    let line = lines.find(item => Math.abs(item.y - y) <= 7)
    if (!line) { line = { y, words: [] }; lines.push(line) }
    line.words.push(word)
  }
  return lines.sort((left, right) => left.y - right.y).map(line => line.words.sort((left, right) => left.bbox.x0 - right.bbox.x0).map(word => word.text).join(' ')).join('\n')
}

function weekdayColumns(positionedWords, region) {
  const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const headerCandidates = positionedWords.map(word => ({ ...word, day: normalizeDay(clean(word.text)) })).filter(word => dayOrder.includes(word.day))
  const headerRows = []
  for (const word of headerCandidates) {
    let row = headerRows.find(item => Math.abs(item.y - word.y) <= 20)
    if (!row) { row = { y: word.y, words: [] }; headerRows.push(row) }
    row.words.push(word)
  }
  const detected = (headerRows.sort((left, right) => new Set(right.words.map(word => word.day)).size - new Set(left.words.map(word => word.day)).size || left.y - right.y)[0]?.words || []).sort((left, right) => left.x - right.x)
  if (detected.length < 4) return []
  const steps = []
  for (let left = 0; left < detected.length; left += 1) for (let right = left + 1; right < detected.length; right += 1) { const difference = dayOrder.indexOf(detected[right].day) - dayOrder.indexOf(detected[left].day); if (difference > 0) steps.push((detected[right].x - detected[left].x) / difference) }
  const step = median(steps)
  const origins = detected.map(header => header.x - dayOrder.indexOf(header.day) * step)
  const origin = median(origins)
  const headers = dayOrder.map((day, index) => detected.find(header => header.day === day) || { day, x: origin + index * step, bbox: detected[0].bbox, inferred: true })
  return headers.map((header, index) => ({
    day: header.day,
    x0: index ? (headers[index - 1].x + header.x) / 2 : Math.max(region.x0, header.x - step / 2),
    x1: index < headers.length - 1 ? (header.x + headers[index + 1].x) / 2 : Math.min(region.x1, header.x + step / 2),
    header
  }))
}

function columnHeaderBottom(columns) {
  return Math.max(...columns.map(column => column.header.bbox.y1))
}

function timeLabels(positionedWords, firstColumnX, region) {
  return positionedWords.filter(word => word.x < firstColumnX && word.y > region.y0 && word.y < region.y1)
    .map(word => ({ ...word, minutes: /^\d{4}$/.test(clean(word.text)) ? parseTime(clean(word.text)) : null }))
    .filter(word => word.minutes !== null)
}

function looksLikeRejectedCode(value) {
  const token = clean(value)
  return token.length >= 5 && token.length <= 10 && /[A-Z]/.test(token) && /\d/.test(token) && !/^(?:WK|WKI|WEEK|TR|LT|SR|SCL|LHN|EXAM|SWLAB|LEC|TUT|LAB|SEM|PRJ)/.test(token) && !/^\d{3,4}(?:TO|T0|O)?\d{3,4}$/.test(token)
}

const CLASS_FRAGMENT_PATTERN = /\b(?:LEC(?:TURE)?(?:\/STU)?|TUT(?:ORIAL)?|SEM(?:INAR)?|LAB(?:ORATORY)?|PRJ|PROJECT|DES|WORKSHOP|FIELDWORK)\b/i

function strongSessionBlockCount(words, blockExtent) {
  const explicitTimes = words.filter(word => explicitTimeRange(word.text))
  const classFragments = words.filter(word => CLASS_FRAGMENT_PATTERN.test(word.text) && explicitTimes.some(time => Math.abs(time.y - word.y) <= blockExtent))
    .sort((left, right) => left.y - right.y)
  return classFragments.filter((word, index) => !classFragments.slice(0, index).some(previous => Math.abs(previous.y - word.y) <= 20)).length
}

function columnOverlap(word, column) {
  const width = Math.max(1, word.bbox.x1 - word.bbox.x0)
  const overlap = Math.max(0, Math.min(word.bbox.x1, column.x1) - Math.max(word.bbox.x0, column.x0))
  return overlap / width
}

function assignedColumn(word, columns) {
  const step = median(columns.slice(1).map((column, index) => column.header.x - columns[index].header.x)) || 1
  const candidates = columns.map(column => {
    const overlap = columnOverlap(word, column)
    const distance = Math.abs(word.x - column.header.x) / step
    return { column, overlap, distance, score: overlap - distance * 0.2 }
  }).filter(candidate => candidate.overlap >= 0.2 || candidate.distance <= 0.5)
    .sort((left, right) => right.score - left.score || left.distance - right.distance)
  if (!candidates.length) return null
  const [best, second] = candidates
  if (second && Math.abs(best.score - second.score) <= 0.02 && Math.abs(best.distance - second.distance) <= 0.05) return null
  return best.column
}

function uniqueStarts(words, allowedCodes) {
  const starts = words.map(word => ({ word, match: matchAllowedCode(word.text, allowedCodes) })).filter(item => item.match).sort((left, right) => left.word.y - right.word.y || left.word.x - right.word.x)
  return starts.filter((start, index) => !starts.slice(0, index).some(previous => previous.match.code === start.match.code && Math.abs(previous.word.y - start.word.y) <= 16))
}

function sessionKey(session) {
  return [session.classType, session.groupLabel, session.dayOfWeek, session.startMinutes, session.endMinutes, session.venue, session.recurrence, session.weekNumbers.join(',')].join('|')
}

function baseModule(code) {
  return { candidateId: candidateId('module'), code, title: null, academicUnits: null, indexNumber: null, courseType: null, registrationStatus: 'UNKNOWN', confidence: 0.45, selected: true, sessions: [], examCandidate: null, fieldProvenance: {}, corrections: [], publicEnrichment: null, publicEnrichmentConfirmed: true }
}

export function parseNtuGrid(words = [], source = 'NTU_TIMETABLE_IMAGE', blocks = [], options = {}) {
  const positionedWords = words.filter(word => word.bbox).map(word => ({ ...word, ...centre(word) }))
  const region = options.region || { x0: 0, y0: 0, x1: Math.max(1, ...positionedWords.map(word => word.bbox.x1)), y1: Math.max(1, ...positionedWords.map(word => word.bbox.y1)) }
  const allowedCodes = options.allowedCodes || []
  if (!allowedCodes.length) {
    const legacyBlocks = blocks.filter(block => block.bbox && findModuleCodes(block.text).length)
    const legacyWords = legacyBlocks.length ? legacyBlocks : positionedWords.filter(word => findModuleCodes(word.text).length)
    const headers = positionedWords.map(word => ({ ...word, day: normalizeDay(clean(word.text)) })).filter(word => word.day)
    const times = positionedWords.map(word => ({ ...word, minutes: /^\d{3,4}$/.test(clean(word.text)) ? parseTime(clean(word.text)) : null })).filter(word => word.minutes !== null)
    const rowHeight = inferredRowHeight(times)
    const modules = new Map()
    for (const entry of legacyWords) {
      const code = findModuleCodes(entry.text)[0]
      if (!code) continue
      if (!modules.has(code)) modules.set(code, baseModule(code))
      const point = centre(entry)
      const day = headers.reduce((best, header) => !best || Math.abs(header.x - point.x) < Math.abs(best.x - point.x) ? header : best, null)
      const startMinutes = minutesAtY(entry.bbox.y0, times, rowHeight)
      const endMinutes = entry.bbox.y1 - entry.bbox.y0 >= (rowHeight || Infinity) * 0.65 ? minutesAtY(entry.bbox.y1, times, rowHeight) : null
      const warnings = ['Day was inferred from the timetable column.', 'Weekly-grid detection is beta.']
      if (!endMinutes || endMinutes <= startMinutes) warnings.push('End time needs confirmation.')
      const validEnd = Number.isInteger(endMinutes) && Number.isInteger(startMinutes) && endMinutes > startMinutes
      const parsed = parseNtuSessionBlock(entry.text, { dayOfWeek: day?.day || null, startMinutes, endMinutes: validEnd ? endMinutes : null, timeConfirmed: validEnd, confidence: validEnd ? 0.66 : 0.35, warnings }) || { candidateId: candidateId('session'), classType: 'OTHER', groupLabel: 'DEFAULT', dayOfWeek: day?.day || null, startMinutes, endMinutes: validEnd ? endMinutes : null, timeConfirmed: validEnd, timeAlternatives: [], venue: null, deliveryMode: 'UNKNOWN', deliveryModeConfirmed: false, recurrence: 'WEEKLY', recurrenceConfirmed: false, weekNumbers: [], confidence: validEnd ? 0.66 : 0.35, selected: true, warnings: [...warnings, 'Class details need confirmation.', 'Delivery mode needs confirmation.', 'Week pattern needs confirmation.'] }
      if (parsed) modules.get(code).sessions.push(parsed)
    }
    return { source, modules: [...modules.values()], unmatchedTimetableText: [], warnings: ['No registered-course allowlist was available; review every detected module.'] }
  }

  const columns = weekdayColumns(positionedWords, region)
  const modules = new Map(allowedCodes.map(code => [code, baseModule(code)]))
  const unmatchedTimetableText = []
  const corrections = []
  if (!columns.length) return { source, modules: [...modules.values()], unmatchedTimetableText, corrections, detectedSessionBlocks: {}, detectedSessionBlockCount: 0, droppedSessionBlockCount: 0, warnings: ['Weekday headers could not be reconstructed. No grid sessions were created.'] }
  const labels = timeLabels(positionedWords, columns[0].x0, region)
  const rowHeight = inferredRowHeight(labels)
  const wordsByColumn = new Map(columns.map(column => [column.day, []]))
  for (const word of positionedWords) {
    if (word.y <= columnHeaderBottom(columns) || word.y >= region.y1) continue
    const column = assignedColumn(word, columns)
    if (column) wordsByColumn.get(column.day).push(word)
  }
  const detectedSessionBlocks = {}
  let detectedSessionBlockCount = 0
  let droppedSessionBlockCount = 0

  for (const column of columns) {
    const columnWords = wordsByColumn.get(column.day)
    const starts = uniqueStarts(columnWords, allowedCodes)
    for (const start of starts) detectedSessionBlocks[start.match.code] = (detectedSessionBlocks[start.match.code] || 0) + 1
    const consumed = new Set()
    const blockExtent = Math.max(48, Math.min(120, (rowHeight || 38) * 2.4))
    detectedSessionBlockCount += strongSessionBlockCount(columnWords, blockExtent)
    for (const [index, start] of starts.entries()) {
      const previousY = starts[index - 1]?.word.y
      const nextY = starts[index + 1]?.word.y
      const y0 = Math.max(column.header.bbox.y1, start.word.y - blockExtent, previousY === undefined ? -Infinity : (previousY + start.word.y) / 2)
      const y1 = Math.min(region.y1, start.word.y + blockExtent, nextY === undefined ? Infinity : (start.word.y + nextY) / 2)
      const chunkWords = columnWords.filter(word => word.y >= y0 && word.y < y1)
      const text = textFromWords(chunkWords)
      const explicit = explicitTimeRange(text)
      const geometryStart = minutesAtY(start.word.bbox.y0, labels, rowHeight)
      const lastWordBottom = Math.max(...chunkWords.map(word => word.bbox.y1))
      const geometryEnd = minutesAtY(lastWordBottom, labels, rowHeight)
      const geometryValid = geometryStart !== null && geometryEnd !== null && geometryEnd > geometryStart
      const geometryDisagrees = Boolean(explicit && geometryValid && (Math.abs(explicit.startMinutes - geometryStart) > 30 || Math.abs(explicit.endMinutes - geometryEnd) > 60))
      const warnings = ['Day was assigned from the detected timetable column.']
      if (!explicit) warnings.push('Time was inferred from grid geometry because no clear time text was read.')
      if (geometryDisagrees) warnings.push('The explicit time printed in the class block was preferred over approximate grid geometry.')
      const startMinutes = explicit?.startMinutes ?? geometryStart
      const endMinutes = explicit?.endMinutes ?? (geometryValid ? geometryEnd : null)
      const timeAlternatives = []
      const parsed = parseNtuSessionBlock(text, { dayOfWeek: column.day, startMinutes, endMinutes, timeConfirmed: startMinutes !== null && endMinutes !== null, timeAlternatives, defaultWeekly: true, codeTokens: [start.word.text, start.match.code], confidence: explicit ? 0.9 : 0.62, warnings })
      if (!parsed) {
        droppedSessionBlockCount += 1
        unmatchedTimetableText.push({ candidateId: candidateId('unmatched'), text, selected: false, attachToCandidateId: null, warnings: ['A registered module code was seen, but the class details could not be reconstructed.'] })
        chunkWords.forEach(word => consumed.add(word))
        continue
      }
      const sessions = modules.get(start.match.code).sessions
      if (!sessions.some(session => sessionKey(session) === sessionKey(parsed))) sessions.push(parsed)
      chunkWords.forEach(word => consumed.add(word))
      if (start.match.corrected) corrections.push({ code: start.match.code, original: start.word.text, corrected: start.match.code, reason: 'Corrected using the registered-course table allowlist.' })
    }
    const unassociated = columnWords.filter(word => !consumed.has(word) && !matchAllowedCode(word.text, allowedCodes) && (looksLikeRejectedCode(word.text) || hasPhysicalVenue(word.text)))
    for (const word of unassociated) unmatchedTimetableText.push({
      candidateId: candidateId('unmatched'), text: word.text, selected: false, attachToCandidateId: null,
      warnings: [hasPhysicalVenue(word.text) ? 'This venue-like OCR fragment could not be associated with one class block safely.' : 'This code-like OCR text was not present in the registered-course table.']
    })
  }
  const seenUnmatched = new Set()
  return {
    source,
    modules: [...modules.values()], corrections,
    detectedSessionBlocks,
    detectedSessionBlockCount,
    droppedSessionBlockCount,
    unmatchedTimetableText: unmatchedTimetableText.filter(item => { const key = clean(item.text); if (seenUnmatched.has(key)) return false; seenUnmatched.add(key); return true }),
    warnings: columns.length < 6 ? ['Some timetable weekday columns were not detected.'] : []
  }
}
