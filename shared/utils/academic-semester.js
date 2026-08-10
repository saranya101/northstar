export function normalizeAcademicYearLabel(value) {
  const match = String(value || '').trim().match(/^(\d{4})(?:\s*\/\s*(\d{4}|\d{2}))?$/)
  if (!match) return null
  const academicYearStart = Number(match[1])
  const expectedEnd = academicYearStart + 1
  if (match[2]) {
    const suppliedEnd = match[2].length === 2
      ? Number(`${String(expectedEnd).slice(0, 2)}${match[2]}`)
      : Number(match[2])
    if (suppliedEnd !== expectedEnd) return null
  }
  return `${academicYearStart}/${expectedEnd}`
}

export function parseAcademicSemesterText(text) {
  const value = String(text || '')
  const labelledYear = /\b(?:academic\s+year|AY)\s*:?\s*(\d{4})(?:\s*\/\s*(\d{4}|\d{2})(?!\d))?/i.exec(value)
  const unlabelledYear = /\b(\d{4})\s*\/\s*(\d{4}|\d{2})\b/.exec(value)
  const semester = /\b(?:semester|sem)\s*:?\s*(?:semester\s*)?([1-4])\b/i.exec(value)
  const yearValue = labelledYear
    ? `${labelledYear[1]}${labelledYear[2] ? `/${labelledYear[2]}` : ''}`
    : unlabelledYear ? `${unlabelledYear[1]}/${unlabelledYear[2]}` : null
  const academicYearLabel = normalizeAcademicYearLabel(yearValue)
  const semesterNumber = semester ? Number(semester[1]) : null
  if (!academicYearLabel || !semesterNumber) return null
  const academicYearStart = Number(academicYearLabel.slice(0, 4))
  return { academicYearStart, academicYearLabel, semesterNumber, displayLabel: `${academicYearLabel} Semester ${semesterNumber}` }
}
