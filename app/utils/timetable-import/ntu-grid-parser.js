import { candidateId } from './timetable-candidate-normaliser'
import { hasPhysicalVenue } from './timetable-delivery'
import { calibrateTimeScale, calibrateWeekdayColumns, gridMinutesAtY, inferredRowHeight, itemCentre, median } from './ntu-grid-geometry'
import { parseNtuSessionBlock } from './ntu-session-block-parser'
import { matchAllowedCode } from './ntu-registered-table-parser'
import { normalizeDay, parseTime } from './timetable-time'
import { findModuleCodes } from './timetable-text-parser'

const centre = itemCentre
function clean(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }

function minutesAtY(y, times, rowHeight) {
  return gridMinutesAtY(y, times, rowHeight)
}

export function explicitTimeRange(text) {
  const value = String(text || '')
  const candidates = [
    ...value.matchAll(/(?:^|\D)(\d{4})\s*(?:TO|T0|[-–—])\s*(\d{4})(?=\D|$)/gi),
    ...value.matchAll(/(?:^|\D)(\d{4})\s*[0O]\s*(\d{4})(?=\D|$)/gi),
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

function columnHeaderBottom(columns) {
  return Math.max(...columns.map(column => column.header.bbox.y1))
}

function timeLabels(positionedWords, firstColumnX, region) {
  return calibrateTimeScale(positionedWords, [{ x0: firstColumnX }], region).labels
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

function overlapRatio(word, block) {
  const x = Math.max(0, Math.min(word.bbox.x1, block.bbox.x1) - Math.max(word.bbox.x0, block.bbox.x0))
  const y = Math.max(0, Math.min(word.bbox.y1, block.bbox.y1) - Math.max(word.bbox.y0, block.bbox.y0))
  const area = Math.max(1, (word.bbox.x1 - word.bbox.x0) * (word.bbox.y1 - word.bbox.y0))
  return x * y / area
}

function wordsByPhysicalBlock(words, blocks) {
  const assignments = new Map(blocks.map(block => [block.blockId, []]))
  for (const word of words.filter(item => item.bbox)) {
    const point = centre(word)
    const candidates = blocks.map(block => {
      const inside = point.x >= block.bbox.x0 - 2 && point.x <= block.bbox.x1 + 2 && point.y >= block.bbox.y0 - 2 && point.y <= block.bbox.y1 + 2
      const overlap = overlapRatio(word, block)
      return { block, inside, overlap, score: Number(inside) * 2 + overlap }
    }).filter(item => item.inside || item.overlap >= 0.35).sort((left, right) => right.score - left.score)
    if (!candidates.length) continue
    if (candidates[1] && Math.abs(candidates[0].score - candidates[1].score) <= 0.05) continue
    assignments.get(candidates[0].block.blockId).push(word)
  }
  return assignments
}

function resolveRegisteredCode(words, allowedCodes) {
  const matches = words.map(word => ({ word, match: matchAllowedCode(word.text, allowedCodes), exact: allowedCodes.includes(clean(word.text)) })).filter(item => item.match)
  const exactCodes = [...new Set(matches.filter(item => item.exact).map(item => item.match.code))]
  if (exactCodes.length > 1) return { code: null, ambiguous: true, exact: false, matches }
  if (exactCodes.length === 1) return { code: exactCodes[0], ambiguous: false, exact: true, matches }
  const correctedCodes = [...new Set(matches.map(item => item.match.code))]
  if (correctedCodes.length !== 1) return { code: null, ambiguous: correctedCodes.length > 1, exact: false, matches }
  return { code: correctedCodes[0], ambiguous: false, exact: false, matches }
}

function blockPassCandidate(words, block, allowedCodes) {
  const text = textFromWords(words)
  const code = resolveRegisteredCode(words, allowedCodes)
  const explicit = explicitTimeRange(text)
  const geometryValid = Number.isInteger(block.geometryStartMinutes) && Number.isInteger(block.geometryEndMinutes) && block.geometryEndMinutes > block.geometryStartMinutes
  const startMinutes = explicit?.startMinutes ?? (geometryValid ? block.geometryStartMinutes : null)
  const endMinutes = explicit?.endMinutes ?? (geometryValid ? block.geometryEndMinutes : null)
  const warnings = ['Day was assigned from the detected physical class rectangle.']
  const timeAlternatives = []
  if (!explicit) {
    warnings.push(geometryValid ? 'Time was inferred from calibrated rectangle geometry and must be confirmed.' : 'No reliable time was found inside this class rectangle.')
    if (geometryValid) timeAlternatives.push({ source: 'GRID_GEOMETRY', startMinutes, endMinutes, confidence: block.geometryTimeReliable ? 0.7 : 0.45, label: `Use ${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}–${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`, warnings: [] })
  }
  if (code.ambiguous) warnings.push('Module assignment is ambiguous across registered modules.')
  const parsed = parseNtuSessionBlock(text, {
    dayOfWeek: block.dayOfWeek,
    startMinutes,
    endMinutes,
    timeConfirmed: Boolean(explicit),
    timeAlternatives,
    defaultWeekly: true,
    codeTokens: code.matches.flatMap(item => [item.word.text, item.match.code]),
    confidence: explicit && code.exact ? 0.96 : explicit ? 0.84 : 0.55,
    warnings
  })
  if (!parsed) return { code, text, explicit, session: null, score: 0 }
  const fieldSources = {
    moduleCode: code.exact ? 'EXTRACTED' : code.code ? 'INFERRED' : 'INFERRED',
    classType: 'EXTRACTED',
    groupLabel: parsed.groupLabel === 'DEFAULT' ? 'INFERRED' : 'EXTRACTED',
    dayOfWeek: 'INFERRED',
    startMinutes: explicit ? 'EXTRACTED' : 'INFERRED',
    endMinutes: explicit ? 'EXTRACTED' : 'INFERRED',
    venue: parsed.venue ? 'EXTRACTED' : 'INFERRED',
    deliveryMode: parsed.deliveryMode === 'UNKNOWN' ? 'INFERRED' : 'EXTRACTED',
    recurrence: parsed.weekNumbers.length ? 'EXTRACTED' : 'INFERRED',
    weekNumbers: parsed.weekNumbers.length ? 'EXTRACTED' : 'INFERRED'
  }
  const session = {
    ...parsed,
    blockId: block.blockId,
    moduleAssignmentConfirmed: Boolean(code.code && !code.ambiguous),
    fieldSources,
    originalValues: {
      moduleCode: code.code,
      classType: parsed.classType,
      groupLabel: parsed.groupLabel,
      dayOfWeek: parsed.dayOfWeek,
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
      venue: parsed.venue,
      deliveryMode: parsed.deliveryMode,
      recurrence: parsed.recurrence,
      weekNumbers: parsed.weekNumbers
    }
  }
  const score = Number(code.exact) * 8 + Number(Boolean(code.code)) * 4 + Number(Boolean(explicit)) * 5 + Number(Boolean(parsed.venue)) + Number(parsed.groupLabel !== 'DEFAULT') + Math.min(parsed.weekNumbers.length, 13) / 10
  return { code, text, explicit, session, score }
}

function mergeBlockCandidates(candidates, resolvedCode) {
  const eligible = candidates.filter(candidate => candidate.session && (!candidate.code.code || candidate.code.code === resolvedCode)).sort((left, right) => right.score - left.score)
  if (!eligible.length) return null
  const best = structuredClone(eligible[0].session)
  const sameBlock = eligible.map(candidate => candidate.session)
  const richerGroup = sameBlock.find(session => session.groupLabel !== 'DEFAULT')
  const richerVenue = sameBlock.find(session => session.venue)
  const richerWeeks = sameBlock.find(session => session.weekNumbers.length)
  const explicitTime = eligible.find(candidate => candidate.explicit)?.session
  if (best.groupLabel === 'DEFAULT' && richerGroup) best.groupLabel = richerGroup.groupLabel
  if (!best.venue && richerVenue) { best.venue = richerVenue.venue; best.deliveryMode = richerVenue.deliveryMode; best.deliveryModeConfirmed = richerVenue.deliveryModeConfirmed }
  if (!best.weekNumbers.length && richerWeeks) { best.recurrence = richerWeeks.recurrence; best.recurrenceConfirmed = richerWeeks.recurrenceConfirmed; best.weekNumbers = richerWeeks.weekNumbers }
  if (explicitTime) {
    best.startMinutes = explicitTime.startMinutes
    best.endMinutes = explicitTime.endMinutes
    best.timeConfirmed = true
    best.timeAlternatives = []
    best.fieldSources.startMinutes = 'EXTRACTED'
    best.fieldSources.endMinutes = 'EXTRACTED'
  }
  best.moduleAssignmentConfirmed = true
  best.originalValues = { ...best.originalValues, moduleCode: resolvedCode }
  return best
}

function parsePhysicalGrid(wordVariants, physicalBlocks, source, allowedCodes) {
  const uniqueBlocks = []
  const seenBlockIds = new Set()
  let duplicateSessionBlockCount = 0
  for (const block of physicalBlocks) {
    if (seenBlockIds.has(block.blockId)) { duplicateSessionBlockCount += 1; continue }
    seenBlockIds.add(block.blockId)
    uniqueBlocks.push(block)
  }
  const assignments = wordVariants.map(words => wordsByPhysicalBlock(words, uniqueBlocks))
  const modules = new Map(allowedCodes.map(code => [code, baseModule(code)]))
  const unmatchedTimetableText = []
  const unresolvedBlockIds = []
  const detectedSessionBlocks = {}
  const corrections = []
  for (const block of uniqueBlocks) {
    const candidates = assignments.map(assignment => blockPassCandidate(assignment.get(block.blockId) || [], block, allowedCodes))
    const exactCodes = [...new Set(candidates.filter(candidate => candidate.code.exact).map(candidate => candidate.code.code).filter(Boolean))]
    const possibleCodes = [...new Set(candidates.map(candidate => candidate.code.code).filter(Boolean))]
    const resolvedCode = exactCodes.length === 1 ? exactCodes[0] : exactCodes.length === 0 && possibleCodes.length === 1 ? possibleCodes[0] : null
    const session = resolvedCode ? mergeBlockCandidates(candidates, resolvedCode) : null
    if (!resolvedCode || !session) {
      unresolvedBlockIds.push(block.blockId)
      const fallback = candidates.filter(candidate => candidate.session).sort((left, right) => right.score - left.score)[0]
      unmatchedTimetableText.push({
        candidateId: candidateId('unmatched'),
        blockId: block.blockId,
        text: [...new Set(candidates.map(candidate => candidate.text).filter(Boolean))].join('\n---\n') || `Unresolved ${block.dayOfWeek} class block`,
        sessionCandidate: fallback ? { ...fallback.session, moduleAssignmentConfirmed: false } : null,
        selected: false,
        attachToCandidateId: null,
        warnings: [resolvedCode ? 'The class rectangle did not produce one valid session candidate.' : 'The module code could not be resolved uniquely against the registered-course table.']
      })
      continue
    }
    modules.get(resolvedCode).sessions.push(session)
    detectedSessionBlocks[resolvedCode] = (detectedSessionBlocks[resolvedCode] || 0) + 1
    const corrected = candidates.find(candidate => candidate.code.code === resolvedCode && !candidate.code.exact)?.code.matches.find(item => item.match.code === resolvedCode)
    if (!candidates.some(candidate => candidate.code.exact && candidate.code.code === resolvedCode) && corrected) corrections.push({ code: resolvedCode, original: corrected.word.text, corrected: resolvedCode, reason: `Corrected inside physical block ${block.blockId} using the registered-course table allowlist.` })
  }
  return {
    source,
    modules: [...modules.values()],
    corrections,
    physicalBlockIds: uniqueBlocks.map(block => block.blockId),
    unresolvedBlockIds,
    duplicateSessionBlockCount,
    detectedSessionBlocks,
    detectedSessionBlockCount: uniqueBlocks.length,
    droppedSessionBlockCount: unresolvedBlockIds.length,
    unmatchedTimetableText,
    warnings: duplicateSessionBlockCount ? ['Duplicate physical class block IDs were rejected.'] : []
  }
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

  const columns = calibrateWeekdayColumns(positionedWords, region)
  const modules = new Map(allowedCodes.map(code => [code, baseModule(code)]))
  const unmatchedTimetableText = []
  const corrections = []
  if (options.physicalBlocks?.length) {
    const variants = [words, ...(options.wordVariants || [])].map(variant => variant.filter(word => word.bbox))
    return parsePhysicalGrid(variants, options.physicalBlocks, source, allowedCodes)
  }
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
