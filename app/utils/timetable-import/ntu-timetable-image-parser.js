import { detectNtuImageRegions, wordsInRegion } from './ntu-image-regions'
import { parseNtuGrid } from './ntu-grid-parser'
import { parseNtuRegisteredTable } from './ntu-registered-table-parser'

export function parseNtuTimetableImage(extraction, source = 'NTU_TIMETABLE_IMAGE') {
  const words = extraction.words || []
  const dimensions = extraction.dimensions || {}
  const regions = extraction.regions || detectNtuImageRegions(words, dimensions)
  const gridWords = wordsInRegion(words, regions.timetableGridRegion)
  const table = parseNtuRegisteredTable(words, regions.registeredCoursesRegion, gridWords, extraction.refinedTitles || [])
  const gridModuleCodes = [...new Set(gridWords.map(word => String(word.text || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(value => /^[A-Z]{2}\d{4}$/.test(value)))]
  const gridVisible = gridWords.some(word => /^(?:MON|TUE|WED|THU|FRI|SAT)$/i.test(String(word.text || '').replace(/[^A-Z]/gi, ''))) && gridWords.some(word => /^\d{3,4}$/.test(String(word.text || '').replace(/\D/g, '')))
  const structure = { gridVisible, gridModuleCodes, examRowsDetected: table.examRowsDetected || 0, examRowsReconstructed: table.examRowsReconstructed || 0 }
  if (!table.modules.length) return { source, modules: [], sourceSemester: table.sourceSemester, sourceSummary: table.sourceSummary, structure, unmatchedTimetableText: [], segmentation: { confidence: regions.confidence, warnings: regions.warnings }, warnings: [...regions.warnings, ...table.warnings] }
  const allowedCodes = table.modules.map(module => module.code)
  const grid = parseNtuGrid(gridWords, source, [], { allowedCodes, region: regions.timetableGridRegion })
  const sessionsByCode = new Map(grid.modules.map(module => [module.code, module.sessions]))
  const correctionsByCode = new Map()
  for (const correction of grid.corrections || []) {
    const list = correctionsByCode.get(correction.code) || []
    if (!list.some(item => item.original === correction.original)) list.push({ original: correction.original, corrected: correction.corrected, reason: correction.reason })
    correctionsByCode.set(correction.code, list)
  }
  const modules = table.modules.map(module => ({ ...module, sessions: sessionsByCode.get(module.code) || [], corrections: [...module.corrections, ...(correctionsByCode.get(module.code) || [])] }))
  const warnings = [...regions.warnings, ...table.warnings, ...grid.warnings]
  if (table.sourceSummary?.moduleCount && table.sourceSummary.moduleCount !== modules.length) warnings.push('The registered-course total does not match the reconstructed module rows.')
  return { source, modules, sourceSemester: table.sourceSemester, sourceSummary: table.sourceSummary, structure, unmatchedTimetableText: grid.unmatchedTimetableText, segmentation: { confidence: regions.confidence, warnings: regions.warnings }, warnings }
}
