import { sanitiseIdentityText } from './identity-sanitiser'
import { candidateId, mapClassType, mapRegistrationStatus } from './timetable-candidate-normaliser'
import { normalizeDay, parseTimeRange } from './timetable-time'

export const MODULE_CODE_PATTERN = /\b(?=[A-Z0-9]{4,12}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z]{1,6}\d{2,6}[A-Z]?\b/g
const DAY_PATTERN = /\b(MON(?:DAY)?|TUE(?:S|SDAY)?|WED(?:NESDAY)?|THU(?:R|RS|RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/i
const TIME_RANGE_PATTERN = /\b(?:\d{1,2}:?\d{2}\s*(?:AM|PM)?)[ \t]*[-–—][ \t]*(?:\d{1,2}:?\d{2}\s*(?:AM|PM)?)\b/i

export function findModuleCodes(text) {
  return [...new Set(String(text || '').toUpperCase().match(MODULE_CODE_PATTERN) || [])].filter(code => !/^\d+$/.test(code))
}

export function parseTimetableText(rawText, source = 'PASTED_TEXT') {
  const text = sanitiseIdentityText(rawText)
  const modules = new Map()
  const warnings = []
  let currentCode = null

  for (const line of text.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
    const codes = findModuleCodes(line)
    if (codes.length) currentCode = codes[0]
    if (!currentCode) continue
    let module = modules.get(currentCode)
    if (!module) {
      const status = mapRegistrationStatus(line)
      const auMatch = line.match(/(?:\bAU\s*[:=]?\s*|\s)(\d+(?:\.\d+)?)\s*(?:AU\b|CORE\b|GER\b|REGISTERED\b|WAITLIST)/i)
      const indexMatch = line.match(/\b(?:INDEX(?:\s+NUMBER)?\s*[:#]?\s*)?(\d{5})\b/i)
      module = { candidateId: candidateId('module'), code: currentCode, title: null, academicUnits: auMatch ? Number(auMatch[1]) : null, indexNumber: indexMatch?.[1] || null, courseType: /\b(CORE|GER(?:PE|UE)?|PRESCRIBED ELECTIVE|UNRESTRICTED ELECTIVE)\b/i.exec(line)?.[1] || null, registrationStatus: status, confidence: 0.72, selected: true, sessions: [] }
      modules.set(currentCode, module)
    } else if (module.registrationStatus === 'UNKNOWN') module.registrationStatus = mapRegistrationStatus(line)

    const dayMatch = line.match(DAY_PATTERN)
    const timeMatch = line.match(TIME_RANGE_PATTERN)
    if (dayMatch || timeMatch) {
      const time = timeMatch ? parseTimeRange(timeMatch[0]) : null
      const typeMatch = line.match(/\b(LEC(?:TURE)?|TUT(?:ORIAL)?|SEM(?:INAR)?|LAB(?:ORATORY)?|WORKSHOP|PROJECT|FIELDWORK)\b/i)
      const groupMatch = line.match(/\b(?:GROUP|GRP)\s*[:#]?\s*([A-Z0-9-]+)\b/i)
      const sessionWarnings = []
      if (!dayMatch) sessionWarnings.push('Day needs confirmation.')
      if (!time) sessionWarnings.push('Start and end time need confirmation.')
      module.sessions.push({ candidateId: candidateId('session'), classType: mapClassType(typeMatch?.[1]), groupLabel: groupMatch?.[1] || 'DEFAULT', dayOfWeek: normalizeDay(dayMatch?.[1]), startMinutes: time?.startMinutes ?? null, endMinutes: time?.endMinutes ?? null, venue: null, recurrence: 'WEEKLY', weekNumbers: [], confidence: time && dayMatch ? 0.78 : 0.35, selected: module.registrationStatus !== 'EXEMPTED', warnings: sessionWarnings })
    }
  }

  if (!modules.size) warnings.push('No module codes could be detected. Paste clearer registered-course text or add sessions manually.')
  for (const module of modules.values()) if (!module.sessions.length) warnings.push(`${module.code}: no class sessions were detected.`)
  return { source, modules: [...modules.values()], warnings }
}

