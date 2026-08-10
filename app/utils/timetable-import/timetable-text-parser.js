import { sanitiseIdentityText } from './identity-sanitiser'
import { candidateId, mapClassType, mapRegistrationStatus } from './timetable-candidate-normaliser'
import { normalizeDay, parseTimeRange } from './timetable-time'
import { parseNtuSessionBlock } from './ntu-session-block-parser'
import { isStructuredTimetableText, parseStructuredTimetable } from './structured-timetable-parser'
import { detectDeliveryMode } from './timetable-delivery'
import { parseWeekExpression } from './week-expression'
import { parseAcademicSemesterText } from '#shared/utils/academic-semester'

export const MODULE_CODE_PATTERN = /\b(?=[A-Z0-9]{4,12}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z]{1,6}\d{2,6}[A-Z]?\b/g
const DAY_PATTERN = /\b(MON(?:DAY)?|TUE(?:S|SDAY)?|WED(?:NESDAY)?|THU(?:R|RS|RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/i
const TIME_RANGE_PATTERN = /\b(?:\d{1,2}:?\d{2}\s*(?:AM|PM)?)[ \t]*[-–—][ \t]*(?:\d{1,2}:?\d{2}\s*(?:AM|PM)?)\b/i
const CLASS_TYPE_PATTERN = /\b(?:LEC|LECTURE|TUT|TUTORIAL|SEM|SEMINAR|LAB|LABORATORY|WORKSHOP|PROJECT|FIELDWORK)(?:\/STU)?\b/i

export function findModuleCodes(text) {
  return [...new Set(String(text || '').toUpperCase().match(MODULE_CODE_PATTERN) || [])].filter(code => !/^\d+$/.test(code))
}

function humanReadableSession(lines) {
  const text = lines.join('\n')
  const dayMatch = text.match(DAY_PATTERN)
  const timeMatch = text.match(TIME_RANGE_PATTERN)
  const time = timeMatch ? parseTimeRange(timeMatch[0]) : null
  if (!dayMatch || !time) return null
  const venue = /^Venue\s*:\s*(.+)$/im.exec(text)?.[1]?.trim() || null
  const weeks = parseWeekExpression(text)
  const deliveryMode = detectDeliveryMode(venue)
  const warnings = []
  if (deliveryMode === 'UNKNOWN') warnings.push('Delivery mode needs confirmation.')
  if (weeks.warning) warnings.push(weeks.warning)
  return {
    candidateId: candidateId('session'), classType: 'OTHER', groupLabel: 'DEFAULT',
    dayOfWeek: normalizeDay(dayMatch[1]), startMinutes: time.startMinutes, endMinutes: time.endMinutes,
    timeConfirmed: true, timeAlternatives: [], venue, deliveryMode,
    deliveryModeConfirmed: deliveryMode !== 'UNKNOWN', recurrence: weeks.recurrence || 'WEEKLY',
    recurrenceConfirmed: !weeks.warning, weekNumbers: weeks.weekNumbers,
    confidence: warnings.length ? 0.65 : 0.9, selected: true, warnings
  }
}

export function parseTimetableText(rawText, source = 'PASTED_TEXT') {
  const text = sanitiseIdentityText(rawText)
  if (isStructuredTimetableText(text)) return parseStructuredTimetable(text, source)
  const sourceSemester = parseAcademicSemesterText(text)
  const modules = new Map()
  const warnings = []
  let currentCode = null
  let pendingSession = null
  let hasHumanReadableMetadata = false

  const flushPendingSession = () => {
    if (!pendingSession) return
    const module = modules.get(pendingSession.code)
    const session = humanReadableSession(pendingSession.lines)
    if (module && session) module.sessions.push(session)
    pendingSession = null
  }

  for (const line of text.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
    if (pendingSession && /^(?:Venue|Weeks?)\s*:/i.test(line)) {
      pendingSession.lines.push(line)
      continue
    }
    const codes = findModuleCodes(line)
    if (codes.length) {
      flushPendingSession()
      currentCode = codes[0]
    }
    if (!currentCode) continue
    let module = modules.get(currentCode)
    if (!module) {
      const status = mapRegistrationStatus(line)
      const auMatch = line.match(/(?:\bAU\s*[:=]?\s*|\s)(\d+(?:\.\d+)?)\s*(?:AU\b|CORE\b|GER\b|REGISTERED\b|WAITLIST)/i)
      const indexMatch = line.match(/\b(?:INDEX(?:\s+NUMBER)?\s*[:#]?\s*)?(\d{5})\b/i)
      module = { candidateId: candidateId('module'), code: currentCode, title: null, academicUnits: auMatch ? Number(auMatch[1]) : null, indexNumber: indexMatch?.[1] || null, courseType: /\b(CORE|GER(?:PE|UE)?|PRESCRIBED ELECTIVE|UNRESTRICTED ELECTIVE)\b/i.exec(line)?.[1] || null, registrationStatus: status, confidence: 0.72, selected: true, sessions: [] }
      modules.set(currentCode, module)
    } else if (module.registrationStatus === 'UNKNOWN') module.registrationStatus = mapRegistrationStatus(line)

    const headerMatch = new RegExp(`^${currentCode}\\s+(.+)$`, 'i').exec(line)
    if (headerMatch && !CLASS_TYPE_PATTERN.test(headerMatch[1]) && !/^(?:\d+(?:\.\d+)?\s+)?(?:CORE|GER|REGISTERED|WAITLIST|EXEMPT)/i.test(headerMatch[1])) {
      module.title ||= headerMatch[1].trim()
      hasHumanReadableMetadata = true
    }
    const labelledIndex = /^Index(?:\s+Number)?\s*[:#]?\s*(\d{5})\b/i.exec(line)
    if (labelledIndex) {
      module.indexNumber = labelledIndex[1]
      hasHumanReadableMetadata = true
    }
    const labelledAu = /^AU\s*[:=]?\s*(\d+(?:\.\d+)?)\b/i.exec(line)
    if (labelledAu) {
      module.academicUnits = Number(labelledAu[1])
      hasHumanReadableMetadata = true
    }

    const dayMatch = line.match(DAY_PATTERN)
    const timeMatch = line.match(TIME_RANGE_PATTERN)
    if (dayMatch && timeMatch && !CLASS_TYPE_PATTERN.test(line)) {
      flushPendingSession()
      pendingSession = { code: currentCode, lines: [line] }
      hasHumanReadableMetadata = true
      continue
    }
    if (pendingSession) flushPendingSession()
    if (dayMatch || timeMatch || CLASS_TYPE_PATTERN.test(line)) {
      const time = timeMatch ? parseTimeRange(timeMatch[0]) : null
      const sessionWarnings = []
      if (!dayMatch) sessionWarnings.push('Day needs confirmation.')
      if (!time) sessionWarnings.push('Start and end time need confirmation.')
      const session = parseNtuSessionBlock(line, { dayOfWeek: normalizeDay(dayMatch?.[1]), startMinutes: time?.startMinutes ?? null, endMinutes: time?.endMinutes ?? null, confidence: time && dayMatch ? 0.78 : 0.35, warnings: sessionWarnings })
      if (session) {
        session.selected = module.registrationStatus !== 'EXEMPTED'
        module.sessions.push(session)
      }
    }
  }
  flushPendingSession()

  if (!modules.size) warnings.push('No module codes could be detected. Paste clearer registered-course text or add sessions manually.')
  for (const module of modules.values()) if (!module.sessions.length) warnings.push(`${module.code}: no class sessions were detected.`)
  const parsedModules = [...modules.values()]
  const sourceSummary = hasHumanReadableMetadata
    ? { moduleCount: parsedModules.length, totalAcademicUnits: parsedModules.reduce((sum, module) => sum + (module.academicUnits || 0), 0) }
    : null
  return { source, modules: parsedModules, sourceSemester, sourceSummary, warnings }
}
