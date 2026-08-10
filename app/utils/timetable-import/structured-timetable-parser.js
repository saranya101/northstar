import { candidateId, mapRegistrationStatus } from './timetable-candidate-normaliser'
import { normalizeDay, parseTime } from './timetable-time'
import { parseWeekExpression } from './week-expression'
import { parseAcademicSemesterText } from '#shared/utils/academic-semester'

const RECORD_TYPES = new Set(['SEMESTER', 'MODULE', 'SESSION', 'EXAM'])
const MODULE_CODE = /^(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{2,20}$/
const SESSION_TYPES = { LECTURE: 'LECTURE', TUTORIAL: 'TUTORIAL', SEMINAR: 'SEMINAR', LAB: 'LABORATORY', LABORATORY: 'LABORATORY', STUDIO: 'OTHER', PROJECT: 'PROJECT' }
const DELIVERY_MODES = new Set(['IN_PERSON', 'ONLINE', 'HYBRID', 'TBC', 'UNKNOWN'])

export function parseStructuredRecord(line) {
  const parts = String(line || '').split('|')
  const type = parts.shift()?.trim().toUpperCase()
  if (!RECORD_TYPES.has(type)) return null
  const fields = {}
  for (const part of parts) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const key = part.slice(0, separator).trim()
    if (key) fields[key] = part.slice(separator + 1).trim()
  }
  return { type, fields }
}

export function isStructuredTimetableText(text) {
  const records = String(text || '').split(/\r?\n/).map(parseStructuredRecord).filter(Boolean)
  return records.some(record => record.type === 'MODULE') && records.some(record => record.type === 'SESSION' || record.type === 'EXAM')
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
}

function sourceSemester(fields, warnings) {
  const parsed = parseAcademicSemesterText(`Academic Year ${fields.academicYear || ''}\nSemester ${fields.semester || ''}`)
  if (!parsed) {
    warnings.push('Structured semester metadata is invalid or incomplete.')
    return null
  }
  return parsed
}

function moduleCandidate(fields, warnings) {
  const code = String(fields.code || '').trim().toUpperCase()
  if (!MODULE_CODE.test(code)) { warnings.push('A structured module has an invalid code.'); return null }
  const academicUnits = fields.au === undefined ? null : Number(fields.au)
  if (academicUnits !== null && (!Number.isFinite(academicUnits) || academicUnits <= 0 || academicUnits > 30)) warnings.push(`${code}: academic units need confirmation.`)
  const provenance = Object.fromEntries(['code', 'title', 'academicUnits', 'registrationStatus'].map(field => [field, 'STRUCTURED_TEXT']))
  return {
    candidateId: candidateId('module'), code, title: fields.title || null,
    academicUnits: Number.isFinite(academicUnits) && academicUnits > 0 && academicUnits <= 30 ? academicUnits : null,
    indexNumber: fields.index || null, courseType: fields.courseType || null,
    registrationStatus: mapRegistrationStatus(fields.status), confidence: 1, selected: true, sessions: [], examCandidate: null,
    fieldProvenance: provenance, corrections: [], publicEnrichment: null, publicEnrichmentConfirmed: true, titleNeedsReview: false
  }
}

function sessionCandidate(fields, warnings) {
  const classType = SESSION_TYPES[String(fields.type || '').trim().toUpperCase()] || 'OTHER'
  const groupLabel = String(fields.group || '').trim()
  const dayOfWeek = normalizeDay(fields.day)
  const parsedStart = parseTime(fields.start)
  const parsedEnd = parseTime(fields.end, { end: true })
  const validTime = parsedStart !== null && parsedEnd !== null && parsedEnd > parsedStart
  const weeks = parseWeekExpression(`Weeks ${fields.weeks || ''}`)
  const delivery = String(fields.delivery || '').trim().toUpperCase()
  const deliveryMode = DELIVERY_MODES.has(delivery) ? delivery : 'UNKNOWN'
  const sessionWarnings = []
  if (!groupLabel) sessionWarnings.push('Group needs confirmation.')
  if (!dayOfWeek) sessionWarnings.push('Day needs confirmation.')
  if (!validTime) sessionWarnings.push('Start and end time need confirmation.')
  if (weeks.warning) sessionWarnings.push(weeks.warning)
  if (deliveryMode === 'UNKNOWN') sessionWarnings.push('Delivery mode needs confirmation.')
  warnings.push(...sessionWarnings.map(message => `${fields.module || 'Session'}: ${message}`))
  return {
    candidateId: candidateId('session'), moduleAssignmentConfirmed: true,
    fieldSources: Object.fromEntries(['classType', 'groupLabel', 'dayOfWeek', 'startMinutes', 'endMinutes', 'venue', 'deliveryMode', 'recurrence', 'weekNumbers'].map(field => [field, 'EXTRACTED'])),
    originalValues: { classType: fields.type || null, groupLabel: fields.group || null, dayOfWeek: fields.day || null, startMinutes: fields.start || null, endMinutes: fields.end || null, venue: fields.venue || null, deliveryMode: fields.delivery || null, weekNumbers: fields.weeks || null },
    classType, groupLabel: groupLabel || 'DEFAULT', dayOfWeek,
    startMinutes: validTime ? parsedStart : null, endMinutes: validTime ? parsedEnd : null,
    timeConfirmed: validTime, timeAlternatives: [], venue: fields.venue || null,
    deliveryMode, deliveryModeConfirmed: deliveryMode !== 'UNKNOWN',
    recurrence: weeks.recurrence || 'WEEKLY', recurrenceConfirmed: Boolean(weeks.recurrence), weekNumbers: weeks.weekNumbers,
    confidence: sessionWarnings.length ? 0.45 : 1, selected: true, warnings: sessionWarnings
  }
}

function examCandidate(fields, warnings) {
  if (String(fields.none || '').trim().toLowerCase() === 'true') return { applicable: false, rawText: 'Not Applicable', date: null, startMinutes: null, endMinutes: null, confidence: 1 }
  const date = validDate(fields.date)
  const startMinutes = parseTime(fields.start)
  const endMinutes = parseTime(fields.end, { end: true })
  if (!date || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) warnings.push(`${fields.module || 'Exam'}: exam date or time needs confirmation.`)
  return { applicable: true, rawText: [fields.date, fields.start && fields.end ? `${fields.start}-${fields.end}` : null].filter(Boolean).join(' '), date, startMinutes, endMinutes: endMinutes !== null && startMinutes !== null && endMinutes > startMinutes ? endMinutes : null, confidence: date && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? 1 : 0.45 }
}

export function parseStructuredTimetable(text, source = 'PASTED_TEXT') {
  const warnings = []
  const records = String(text || '').split(/\r?\n/).map(parseStructuredRecord).filter(Boolean)
  const modules = new Map()
  const semesterRecord = records.find(record => record.type === 'SEMESTER')
  for (const record of records.filter(item => item.type === 'MODULE')) {
    const module = moduleCandidate(record.fields, warnings)
    if (module) modules.set(module.code, module)
  }
  for (const record of records.filter(item => item.type === 'SESSION')) {
    const code = String(record.fields.module || '').trim().toUpperCase()
    const module = modules.get(code)
    if (!module) { warnings.push(`${code || 'Unknown module'}: structured session has no matching MODULE record.`); continue }
    module.sessions.push(sessionCandidate(record.fields, warnings))
  }
  for (const record of records.filter(item => item.type === 'EXAM')) {
    const code = String(record.fields.module || '').trim().toUpperCase()
    const module = modules.get(code)
    if (!module) { warnings.push(`${code || 'Unknown module'}: structured exam has no matching MODULE record.`); continue }
    module.examCandidate = examCandidate(record.fields, warnings)
    module.fieldProvenance.examCandidate = 'STRUCTURED_TEXT'
  }
  const sourceSemesterValue = semesterRecord ? sourceSemester(semesterRecord.fields, warnings) : null
  const suppliedTotal = semesterRecord?.fields.totalAU === undefined ? null : Number(semesterRecord.fields.totalAU)
  return {
    source, modules: [...modules.values()], sourceSemester: sourceSemesterValue,
    sourceSummary: { moduleCount: modules.size, totalAcademicUnits: Number.isFinite(suppliedTotal) ? suppliedTotal : [...modules.values()].reduce((sum, module) => sum + (module.academicUnits || 0), 0) },
    structure: null, unmatchedTimetableText: [], segmentation: { confidence: 1, warnings: [] }, warnings
  }
}
