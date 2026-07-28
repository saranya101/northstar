import { candidateId } from './timetable-candidate-normaliser'
import { tableGeometry, wordsInRegion } from './ntu-image-regions'
import { clockValueToMinutes } from './timetable-time'

const DENIED_PREFIXES = /^(?:WK|WKI|WEEK|TR|LT|SCL|SR|LHN|EXAM|COLLAB|SWLAB)/
const clean = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const centre = word => ({ x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 })
const digit = character => ({ O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8' }[character] || character)

function canonicalCode(value) {
  let raw = clean(value)
  if (DENIED_PREFIXES.test(raw) || /^\d+$/.test(raw) || raw.length < 5 || raw.length > 9) return null
  if (raw.startsWith('5C')) raw = `SC${raw.slice(2)}`
  if (/^BUS[A-Z0-9]{4}$/.test(raw)) raw = `BU${raw.slice(3)}`
  if (/^C[A-Z0-9]{4}$/.test(raw)) raw = `SC${raw.slice(1)}`
  const match = raw.match(/^([A-Z]{2})([A-Z0-9]{4})$/)
  if (!match) return null
  const result = `${match[1]}${[...match[2]].map(digit).join('')}`
  return /^[A-Z]{2}\d{4}$/.test(result) ? result : null
}

function registeredCode(value) {
  const raw = clean(value)
  return /^[A-Z]{2}\d{4}$/.test(raw) ? raw : null
}

function substitutionCost(left, right) {
  if (left === right) return 0
  if (digit(left) === right || digit(right) === left) return 0.15
  return 1
}

function ocrDistance(leftValue, rightValue) {
  const left = clean(leftValue)
  const right = clean(rightValue)
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0))
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index
  for (let row = 1; row <= left.length; row += 1) for (let column = 1; column <= right.length; column += 1) rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + substitutionCost(left[row - 1], right[column - 1]))
  return rows[left.length][right.length]
}

export function matchAllowedCode(value, allowedCodes) {
  const raw = clean(value)
  const candidates = [raw, raw.match(/^([A-Z0-9]{6})/)?.[1]].filter(Boolean)
  for (const candidate of candidates) {
    const canonical = canonicalCode(candidate)
    if (canonical && allowedCodes.includes(canonical)) return { code: canonical, original: value, corrected: clean(value) !== canonical }
  }
  const choices = allowedCodes.map(code => ({ code, distance: ocrDistance(raw, code) })).sort((left, right) => left.distance - right.distance)
  return choices[0] && choices[0].distance <= Math.max(1.3, Math.min(2.3, raw.length * 0.3)) ? { code: choices[0].code, original: value, corrected: true } : null
}

function gridCodePool(words) {
  const counts = new Map()
  for (const word of words) {
    const raw = clean(word.text)
    const candidates = [raw, raw.match(/^([A-Z0-9]{6})/)?.[1]].filter(Boolean)
    for (const value of candidates) {
      const code = canonicalCode(value)
      if (code) counts.set(code, (counts.get(code) || 0) + 1)
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([code]) => code)
}

function wordsText(words) {
  const sorted = [...words].sort((left, right) => Math.abs(centre(left).y - centre(right).y) > 7 ? centre(left).y - centre(right).y : left.bbox.x0 - right.bbox.x0)
  const lines = []
  for (const word of sorted) {
    const y = centre(word).y
    let line = lines.find(item => Math.abs(item.y - y) <= 7)
    if (!line) { line = { y, words: [] }; lines.push(line) }
    line.words.push(word)
  }
  return lines.sort((left, right) => left.y - right.y).map(line => line.words.sort((left, right) => left.bbox.x0 - right.bbox.x0).map(word => word.text).join(' ')).join(' ').replace(/\s+/g, ' ').trim()
}

function columnWords(words, column, row) {
  return words.filter(word => { const point = centre(word); return point.x >= column.x0 && point.x < column.x1 && point.y >= row.y0 && point.y < row.y1 })
}

function selectTitle(tableValue, refinedValue) {
  const cleanTitle = value => String(value || '')
    .replace(/^[|_]+/, '')
    .replace(/\s*[*~#]+\s*$/g, '')
    .replace(/[|_]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const table = cleanTitle(tableValue)
  const refined = cleanTitle(refinedValue)
  const tableWords = table.split(/\s+/).filter(Boolean).length
  const refinedWords = refined.split(/\s+/).filter(Boolean).length
  const refinedHasGarbage = /[\\|]|\d{2,}/.test(refined)
  if (!refinedHasGarbage && refinedWords >= tableWords + 2) return refined
  if (tableWords >= 2) return table
  return refined || table || null
}

export function parseNtuExam(rawText) {
  const raw = rawText.replace(/\s+/g, ' ').trim()
  if (!raw) return null
  if (/NOT\s+APPLICABLE/i.test(raw)) return { applicable: false, rawText: 'Not Applicable', date: null, startMinutes: null, endMinutes: null, confidence: 0.95 }
  const dateMatch = raw.match(/(\d{2})-([A-Z]{3})-(\d{4})/i)
  const clockDigits = raw.replace(dateMatch?.[0] || '', '').replace(/[^0-9]/g, '')
  const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }
  const month = dateMatch ? months[dateMatch[2].toUpperCase()] : null
  const detectedDate = dateMatch && month ? `${dateMatch[3]}-${month}-${dateMatch[1]}` : null
  const dateValue = detectedDate ? new Date(`${detectedDate}T00:00:00Z`) : null
  const date = dateValue && !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === detectedDate ? detectedDate : null
  const clockCandidates = [...clockDigits.matchAll(/(?=(\d{4}))/g)].map(match => ({ index: match.index, value: match[1] }))
  let parsedStart = null
  let parsedEnd = null
  for (const [index, start] of clockCandidates.entries()) {
    const startMinutes = clockValueToMinutes(start.value)
    if (startMinutes === null) continue
    const end = clockCandidates.slice(index + 1).find(candidate => {
      const minutes = clockValueToMinutes(candidate.value, { end: true })
      return minutes !== null && minutes > startMinutes
    })
    if (!end) continue
    parsedStart = startMinutes
    parsedEnd = clockValueToMinutes(end.value, { end: true })
    break
  }
  const validRange = parsedStart !== null && parsedEnd !== null && parsedEnd > parsedStart
  return { applicable: true, rawText: raw, date, startMinutes: validRange ? parsedStart : null, endMinutes: validRange ? parsedEnd : null, confidence: date && validRange ? 0.92 : 0.45 }
}

export function extractSourceSemester(words = []) {
  const text = wordsText(words)
  const match = text.match(/ACADEMIC\s+YEAR\s+(\d{4})\s*[,;]?\s*SEMESTER\s*(\d)/i)
  if (!match) return null
  const academicYearStart = Number(match[1])
  const semesterNumber = Number(match[2])
  const academicYearLabel = `${academicYearStart}/${academicYearStart + 1}`
  return { academicYearStart, academicYearLabel, semesterNumber, displayLabel: `${academicYearLabel} Semester ${semesterNumber}` }
}

export function parseNtuRegisteredTable(words = [], region, gridWords = [], refinedTitles = []) {
  const scoped = wordsInRegion(words, region)
  const geometry = tableGeometry(words, region)
  if (!geometry || !geometry.rows.length) return { modules: [], sourceSemester: extractSourceSemester(scoped), sourceSummary: null, warnings: ['Registered-course rows could not be reconstructed.'] }
  const pool = gridCodePool(gridWords)
  const used = new Set()
  const modules = []
  const reservedDirectCodes = new Set(geometry.rows.map(row => registeredCode(wordsText(columnWords(scoped, geometry.columns.course, row)))).filter(Boolean))
  for (const [rowIndex, row] of geometry.rows.entries()) {
    const rawCode = wordsText(columnWords(scoped, geometry.columns.course, row))
    const direct = registeredCode(rawCode)
    let code = direct
    if (!code) {
      const choices = pool.filter(value => !used.has(value) && !reservedDirectCodes.has(value)).map(value => ({ value, distance: ocrDistance(rawCode, value) })).sort((left, right) => left.distance - right.distance)
      if (choices[0] && choices[0].distance <= Math.max(2.5, clean(rawCode).length * 0.62)) code = choices[0].value
    }
    if (!code) continue
    used.add(code)
    const corrections = clean(rawCode) && clean(rawCode) !== code ? [{ original: rawCode.trim(), corrected: code, reason: 'Corrected using the registered-course table and repeated timetable-grid occurrences.' }] : []
    const rawIndex = clean(wordsText(columnWords(scoped, geometry.columns.index, row)))
    const indexNumber = /^\d{5}$/.test(rawIndex) ? rawIndex : null
    const titleFromWords = wordsText(columnWords(scoped, geometry.columns.title, row)).replace(/^[-|]+|[-|]+$/g, '').trim()
    const refinedTitle = String(refinedTitles[rowIndex] || '').replace(/\s+/g, ' ').trim()
    const title = selectTitle(titleFromWords, refinedTitle)
    const auText = wordsText(columnWords(scoped, geometry.columns.academicUnits, row))
    const academicUnits = Number(auText.match(/\d+(?:\.\d+)?/)?.[0]) || null
    const statusText = wordsText(columnWords(scoped, geometry.columns.status, row))
    const examText = wordsText(columnWords(scoped, geometry.columns.exam, row))
    const examCandidate = parseNtuExam(examText)
    const titleNeedsReview = Boolean(title && /^[a-z]/.test(title))
    modules.push({
      candidateId: candidateId('module'), code, title, academicUnits, indexNumber, courseType: null,
      registrationStatus: /REGISTER/i.test(statusText) ? 'REGISTERED' : 'UNKNOWN', confidence: 0.9, selected: true, sessions: [],
      examCandidate, fieldProvenance: { code: 'REGISTERED_COURSE_TABLE', title: 'REGISTERED_COURSE_TABLE', academicUnits: 'REGISTERED_COURSE_TABLE', indexNumber: 'REGISTERED_COURSE_TABLE', registrationStatus: 'REGISTERED_COURSE_TABLE', examCandidate: 'REGISTERED_COURSE_TABLE' },
      corrections, publicEnrichment: null, publicEnrichmentConfirmed: true, titleNeedsReview
    })
  }
  const totalWords = geometry.total ? scoped.filter(word => centre(word).y >= geometry.total.bbox.y0 - 5) : []
  const totalText = wordsText(totalWords)
  const count = Number(totalText.match(/TOTAL\s+(\d+)/i)?.[1]) || null
  const totalAcademicUnits = Number(totalText.match(/(?:COURSE\(S\)\s*)?(\d+)\s*AU/i)?.[1]) || modules.reduce((sum, module) => sum + (module.academicUnits || 0), 0)
  const examRowsDetected = geometry.headers.exam ? geometry.rows.length : 0
  const examRowsReconstructed = modules.filter(module => module.examCandidate && (!module.examCandidate.applicable || (module.examCandidate.date && module.examCandidate.startMinutes !== null && module.examCandidate.endMinutes !== null))).length
  return { modules, sourceSemester: extractSourceSemester(scoped), sourceSummary: { moduleCount: count, totalAcademicUnits }, examRowsDetected, examRowsReconstructed, geometry, warnings: modules.length !== count && count ? [`The table reports ${count} courses, but ${modules.length} rows were reconstructed.`] : [] }
}

export { canonicalCode }
