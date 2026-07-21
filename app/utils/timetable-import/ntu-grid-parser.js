import { candidateId } from './timetable-candidate-normaliser'
import { normalizeDay, parseTime } from './timetable-time'
import { findModuleCodes } from './timetable-text-parser'

function centre(word) { return { x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 } }

export function parseNtuGrid(words = [], source = 'NTU_TIMETABLE_IMAGE') {
  const headers = words.map(word => ({ ...word, ...centre(word), day: normalizeDay(word.text) })).filter(word => word.day)
  const times = words.map(word => ({ ...word, ...centre(word), minutes: parseTime(word.text) })).filter(word => word.minutes !== null && /^\d{3,4}$/.test(word.text.trim()))
  const moduleWords = words.map(word => ({ ...word, ...centre(word), code: findModuleCodes(word.text)[0] })).filter(word => word.code)
  const modules = new Map()
  for (const token of moduleWords) {
    const day = headers.reduce((best, header) => !best || Math.abs(header.x - token.x) < Math.abs(best.x - token.x) ? header : best, null)
    const start = times.filter(time => time.y <= token.y).reduce((best, time) => !best || token.y - time.y < token.y - best.y ? time : best, null)
    let module = modules.get(token.code)
    if (!module) {
      module = { candidateId: candidateId('module'), code: token.code, title: null, academicUnits: null, indexNumber: null, courseType: null, registrationStatus: 'UNKNOWN', confidence: 0.45, selected: true, sessions: [] }
      modules.set(token.code, module)
    }
    module.sessions.push({ candidateId: candidateId('session'), classType: 'OTHER', groupLabel: 'DEFAULT', dayOfWeek: day?.day || null, startMinutes: start?.minutes ?? null, endMinutes: null, venue: null, recurrence: 'WEEKLY', weekNumbers: [], confidence: day && start ? 0.42 : 0.2, selected: true, warnings: ['End time needs confirmation.', 'Day was inferred from the timetable column.', 'Weekly-grid detection is beta.'] })
  }
  return { source, modules: [...modules.values()], warnings: ['Weekly timetable grid detection is beta. Confirm every field before saving.'] }
}
