import { candidateId } from './timetable-candidate-normaliser'
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

function explicitTimeRange(text) {
  const candidates = String(text || '').match(/\d[\d\sTOoIl|:–—-]{6,20}\d/g) || []
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '')
    if (digits.length < 8) continue
    const startText = digits.slice(0, 4)
    const endText = digits.slice(-4)
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
  const detected = positionedWords.map(word => ({ ...word, day: normalizeDay(clean(word.text)) })).filter(word => dayOrder.includes(word.day) && word.y <= region.y0 + Math.max(70, (region.y1 - region.y0) * 0.08)).sort((left, right) => left.x - right.x)
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

function timeLabels(positionedWords, firstColumnX, region) {
  return positionedWords.filter(word => word.x < firstColumnX && word.y > region.y0 && word.y < region.y1)
    .map(word => ({ ...word, minutes: /^\d{4}$/.test(clean(word.text)) ? parseTime(clean(word.text)) : null }))
    .filter(word => word.minutes !== null)
}

function looksLikeRejectedCode(value) {
  const token = clean(value)
  return token.length >= 5 && token.length <= 10 && /[A-Z]/.test(token) && /\d/.test(token) && !/^(?:WK|WKI|WEEK|TR|LT|SR|SCL|LHN|EXAM|SWLAB|LEC|TUT|LAB|SEM|PRJ)/.test(token) && !/^\d{3,4}(?:TO|T0|O)?\d{3,4}$/.test(token)
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
  if (!columns.length) return { source, modules: [...modules.values()], unmatchedTimetableText, corrections, warnings: ['Weekday headers could not be reconstructed. No grid sessions were created.'] }
  const labels = timeLabels(positionedWords, columns[0].x0, region)
  const rowHeight = inferredRowHeight(labels)

  for (const column of columns) {
    const columnWords = positionedWords.filter(word => word.x >= column.x0 && word.x < column.x1 && word.y > column.header.bbox.y1 && word.y < region.y1)
    const starts = columnWords.map(word => ({ word, match: matchAllowedCode(word.text, allowedCodes) })).filter(item => item.match).sort((left, right) => left.word.y - right.word.y)
    const rejected = columnWords.filter(word => looksLikeRejectedCode(word.text) && !matchAllowedCode(word.text, allowedCodes))
    for (const word of rejected) unmatchedTimetableText.push({ candidateId: candidateId('unmatched'), text: word.text, selected: false, attachToCandidateId: null, warnings: ['This code-like OCR text was not present in the registered-course table.'] })
    for (const [index, start] of starts.entries()) {
      const nextY = starts[index + 1]?.word.y ?? region.y1
      const chunkWords = columnWords.filter(word => word.y >= start.word.y - 4 && word.y < nextY - 4)
      const text = textFromWords(chunkWords)
      const explicit = explicitTimeRange(text)
      const geometryStart = minutesAtY(start.word.bbox.y0, labels, rowHeight)
      const lastWordBottom = Math.max(...chunkWords.map(word => word.bbox.y1))
      const geometryEnd = minutesAtY(lastWordBottom, labels, rowHeight)
      const geometryValid = geometryStart !== null && geometryEnd !== null && geometryEnd > geometryStart
      const conflict = Boolean(explicit && geometryValid && (Math.abs(explicit.startMinutes - geometryStart) > 30 || Math.abs(explicit.endMinutes - geometryEnd) > 60))
      const warnings = ['Day was assigned from the detected timetable column.']
      if (!explicit) warnings.push('Time was inferred from grid geometry because no clear time text was read.')
      if (conflict) warnings.push(`Time conflict: cell text indicates ${explicit.startMinutes}-${explicit.endMinutes}, while grid geometry indicates ${geometryStart}-${geometryEnd}.`)
      const startMinutes = explicit?.startMinutes ?? geometryStart
      const endMinutes = explicit?.endMinutes ?? (geometryValid ? geometryEnd : null)
      const timeAlternatives = conflict ? [
        { source: 'EXPLICIT_TEXT', startMinutes: explicit.startMinutes, endMinutes: explicit.endMinutes, confidence: 0.9, label: 'Time printed in cell', reason: 'Read directly from the timetable cell.', warnings: [] },
        { source: 'GRID_GEOMETRY', startMinutes: geometryStart, endMinutes: geometryEnd, confidence: 0.62, label: 'Time from grid position', reason: 'Inferred from the cell position against the timetable rows.', warnings: [] }
      ] : []
      const parsed = parseNtuSessionBlock(text, { dayOfWeek: column.day, startMinutes, endMinutes, timeConfirmed: !conflict && startMinutes !== null && endMinutes !== null, timeAlternatives, confidence: explicit && !conflict ? 0.9 : 0.62, warnings })
      if (!parsed) {
        unmatchedTimetableText.push({ candidateId: candidateId('unmatched'), text, selected: false, attachToCandidateId: null, warnings: ['A registered module code was seen, but the class details could not be reconstructed.'] })
        continue
      }
      modules.get(start.match.code).sessions.push(parsed)
      if (start.match.corrected) corrections.push({ code: start.match.code, original: start.word.text, corrected: start.match.code, reason: 'Corrected using the registered-course table allowlist.' })
    }
  }
  const seenUnmatched = new Set()
  return {
    source,
    modules: [...modules.values()], corrections,
    unmatchedTimetableText: unmatchedTimetableText.filter(item => { const key = clean(item.text); if (seenUnmatched.has(key)) return false; seenUnmatched.add(key); return true }),
    warnings: columns.length < 6 ? ['Some timetable weekday columns were not detected.'] : []
  }
}
