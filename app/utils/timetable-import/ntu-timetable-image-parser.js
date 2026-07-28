import { detectNtuImageRegions, wordsInRegion } from './ntu-image-regions'
import { parseNtuGrid } from './ntu-grid-parser'
import { parseNtuRegisteredTable } from './ntu-registered-table-parser'

function sessionKey(session) {
  return [session.classType, session.dayOfWeek, session.startMinutes, session.endMinutes, session.recurrence, session.weekNumbers.join(',')].join('|')
}

function sessionQuality(session) {
  return session.confidence
    + (session.groupLabel && session.groupLabel !== 'DEFAULT' ? 0.05 : 0)
    + (session.venue ? 0.04 : 0)
    + (session.deliveryMode !== 'UNKNOWN' ? 0.02 : 0)
    + Math.min(session.weekNumbers.length, 20) / 1000
}

export function parseNtuTimetableImage(extraction, source = 'NTU_TIMETABLE_IMAGE') {
  const words = extraction.words || []
  const dimensions = extraction.dimensions || {}
  const regions = extraction.regions || detectNtuImageRegions(words, dimensions)
  const gridWords = wordsInRegion(words, regions.timetableGridRegion)
  const gridWordVariants = [gridWords, ...(extraction.wordVariants || []).map(variant => wordsInRegion(variant, regions.timetableGridRegion))]
  const table = parseNtuRegisteredTable(words, regions.registeredCoursesRegion, gridWords, extraction.refinedTitles || [])
  const allGridWords = gridWordVariants.flat()
  const gridModuleCodes = [...new Set(allGridWords.map(word => String(word.text || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(value => /^[A-Z]{2}\d{4}$/.test(value)))]
  const gridVisible = allGridWords.some(word => /^(?:MON|TUE|WED|THU|FRI|SAT)$/i.test(String(word.text || '').replace(/[^A-Z]/gi, ''))) && allGridWords.some(word => /^\d{3,4}$/.test(String(word.text || '').replace(/\D/g, '')))
  const structure = { gridVisible, gridModuleCodes, detectedSessionBlocks: {}, detectedSessionBlockCount: 0, droppedSessionBlockCount: 0, examRowsDetected: table.examRowsDetected || 0, examRowsReconstructed: table.examRowsReconstructed || 0 }
  if (!table.modules.length) return { source, modules: [], sourceSemester: table.sourceSemester, sourceSummary: table.sourceSummary, structure, unmatchedTimetableText: [], segmentation: { confidence: regions.confidence, warnings: regions.warnings }, warnings: [...regions.warnings, ...table.warnings] }
  const allowedCodes = table.modules.map(module => module.code)
  const grids = gridWordVariants.map(variant => parseNtuGrid(variant, source, [], { allowedCodes, region: regions.timetableGridRegion }))
  const grid = grids[0]
  const sessionsByCode = new Map(allowedCodes.map(code => [code, []]))
  for (const parsedGrid of grids) {
    structure.detectedSessionBlockCount = Math.max(structure.detectedSessionBlockCount, parsedGrid.detectedSessionBlockCount || 0)
    for (const [code, count] of Object.entries(parsedGrid.detectedSessionBlocks || {})) structure.detectedSessionBlocks[code] = Math.max(structure.detectedSessionBlocks[code] || 0, count)
    for (const module of parsedGrid.modules) {
      const sessions = sessionsByCode.get(module.code)
      for (const session of module.sessions) {
        const key = sessionKey(session)
        const existingIndex = sessions.findIndex(existing => sessionKey(existing) === key)
        if (existingIndex < 0) sessions.push(session)
        else if (sessionQuality(session) > sessionQuality(sessions[existingIndex])) sessions[existingIndex] = session
      }
    }
  }
  const codeMismatchCount = Object.entries(structure.detectedSessionBlocks).reduce((count, [code, detected]) => count + Math.max(0, detected - (sessionsByCode.get(code)?.length || 0)), 0)
  const totalSessionCount = [...sessionsByCode.values()].reduce((count, sessions) => count + sessions.length, 0)
  structure.droppedSessionBlockCount = Math.max(codeMismatchCount, structure.detectedSessionBlockCount - totalSessionCount, 0)
  const correctionsByCode = new Map()
  for (const parsedGrid of grids) {
    for (const correction of parsedGrid.corrections || []) {
      const list = correctionsByCode.get(correction.code) || []
      if (!list.some(item => item.original === correction.original)) list.push({ original: correction.original, corrected: correction.corrected, reason: correction.reason })
      correctionsByCode.set(correction.code, list)
    }
  }
  const modules = table.modules.map(module => ({ ...module, sessions: sessionsByCode.get(module.code) || [], corrections: [...module.corrections, ...(correctionsByCode.get(module.code) || [])] }))
  const warnings = [...new Set([...regions.warnings, ...table.warnings, ...grids.flatMap(parsedGrid => parsedGrid.warnings)])]
  if (table.sourceSummary?.moduleCount && table.sourceSummary.moduleCount !== modules.length) warnings.push('The registered-course total does not match the reconstructed module rows.')
  return { source, modules, sourceSemester: table.sourceSemester, sourceSummary: table.sourceSummary, structure, unmatchedTimetableText: grid.unmatchedTimetableText, segmentation: { confidence: regions.confidence, warnings: regions.warnings }, warnings }
}
