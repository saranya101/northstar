export const COURSE_OUTLINE_PARSER_VERSION = 'deterministic-1'

const ASSESSMENT_TYPES = [
  ['FINAL_EXAMINATION', /\b(final\s+exam(?:ination)?|end[- ]of[- ]semester exam)\b/i],
  ['MIDTERM', /\b(midterm|mid[- ]semester (?:exam|test))\b/i],
  ['QUIZ', /\bquiz\b/i],
  ['CLASS_PARTICIPATION', /\b(class )?participation\b/i],
  ['ATTENDANCE', /\battendance\b/i],
  ['PRESENTATION', /\bpresentation\b/i],
  ['REFLECTION', /\breflection\b/i],
  ['CASE_ANALYSIS', /\bcase (?:analysis|study)\b/i],
  ['LABORATORY', /\b(?:laboratory|lab)\b/i],
  ['PRACTICAL', /\bpractical\b/i],
  ['ORAL_EXAMINATION', /\b(?:oral examination|viva)\b/i],
  ['PEER_ASSESSMENT', /\bpeer assessment\b/i],
  ['GROUP_ASSIGNMENT', /\bgroup (?:assignment|project|report)\b/i],
  ['INDIVIDUAL_ASSIGNMENT', /\bindividual (?:assignment|project|report)\b/i],
  ['PROJECT', /\bproject\b/i],
  ['REPORT', /\breport\b/i],
  ['OTHER', /\bassessment\b/i]
]

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const DATE = new RegExp(`\\b(?:\\d{1,2}[ /-]${MONTH}(?:[ /-]\\d{2,4})?|${MONTH}[ /-]\\d{1,2}(?:,? [12]\\d{3})?|\\d{1,2}[/-]\\d{1,2}[/-][12]\\d{3})\\b`, 'i')

function clean(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function pageFor(lines, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const match = lines[cursor].match(/^\[\[PAGE:(\d+)]]$/)
    if (match) return Number(match[1])
  }
  return null
}

function parseDate(value, warnings) {
  if (!value) return null
  const hasYear = /\b(?:19|20)\d{2}\b/.test(value)
  if (!hasYear) {
    warnings.push('A date has no year and was left unresolved.')
    return null
  }
  const parsed = new Date(value.replace(/(\d)(st|nd|rd|th)\b/gi, '$1'))
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())).toISOString()
}

function typeFor(value) {
  return ASSESSMENT_TYPES.find(([, pattern]) => pattern.test(value))?.[0] || null
}

function field(value, confidence, excerpt, pageNumber = null, sectionHeading = null) {
  return { value: value ?? null, confidence: value === null || value === undefined ? 0 : confidence, pageNumber, sectionHeading, sourceExcerpt: excerpt?.slice(0, 500) || null }
}

function labelledFact(lines, labels, key, result, confidence = .9) {
  const pattern = new RegExp(`^(?:${labels.join('|')})\\s*[:–-]\\s*(.+)$`, 'i')
  const index = lines.findIndex(line => pattern.test(line))
  if (index < 0) return
  const match = lines[index].match(pattern)
  result.push({ fieldName: key, ...field(match[1], confidence, lines[index], pageFor(lines, index)), sourceOrder: index })
}

export function parseCourseOutline(input, { activeAcademicYear, activeSemester } = {}) {
  const lines = clean(input)
  const warnings = []
  const facts = []
  const assessments = []
  const weeks = []

  labelledFact(lines, ['module code', 'course code'], 'moduleCode', facts)
  labelledFact(lines, ['module title', 'course title'], 'moduleTitle', facts)
  labelledFact(lines, ['academic units?', 'AU', 'credits?'], 'academicUnits', facts)
  labelledFact(lines, ['course description', 'module description', 'description'], 'description', facts, .8)
  labelledFact(lines, ['learning outcomes?', 'course learning outcomes?'], 'learningOutcomes', facts, .8)
  labelledFact(lines, ['lecturer', 'course coordinator'], 'lecturer', facts)
  labelledFact(lines, ['tutor'], 'tutor', facts)
  labelledFact(lines, ['consultation(?: details| hours)?'], 'consultationDetails', facts)
  labelledFact(lines, ['teaching weeks?'], 'teachingWeeks', facts)
  labelledFact(lines, ['attendance(?: requirement)?'], 'attendanceRequirement', facts)
  labelledFact(lines, ['participation(?: requirement)?'], 'participationRequirement', facts)
  labelledFact(lines, ['academic integrity', 'academic honesty'], 'academicIntegrityNotes', facts)
  labelledFact(lines, ['academic year'], 'academicYear', facts)
  labelledFact(lines, ['semester', 'term'], 'semesterLabel', facts)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\[\[PAGE:\d+]]$/.test(line)) continue
    const week = line.match(/^week\s*(\d{1,2})\s*[:|–-]\s*(.+)$/i)
    if (week) {
      const columns = week[2].split(/\s*\|\s*/)
      weeks.push({ weekNumber: Number(week[1]), topic: columns[0] || null, reading: columns[1] || null, activity: columns[2] || null, importantDate: columns[3] || null, sourceOrder: index, pageNumber: pageFor(lines, index), sourceExcerpt: line.slice(0, 500), confidence: .85 })
    }

    const type = typeFor(line)
    const weightMatch = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*%/)
    if (!type || (!weightMatch && !/\b(?:due|deadline|exam date|event date)\b/i.test(line))) continue
    const dateMatch = line.match(DATE)
    const localWarnings = []
    const date = parseDate(dateMatch?.[0], localWarnings)
    const isDeadline = /\b(?:due|deadline|submit(?:ted|sion)?(?: by)?)\b/i.test(line)
    const isEvent = /\b(?:exam date|event date|held on|presentation date)\b/i.test(line)
    const segments = line.split(/\s*\|\s*|\s+[-–]\s+/)
    const name = (segments[0].replace(/^assessment\s*\d*\s*:\s*/i, '').trim() || null)
    const key = `${name?.toLowerCase()}|${type}|${weightMatch?.[1] || ''}|${date || ''}`
    if (assessments.some(item => item.duplicateKey === key)) continue
    assessments.push({
      duplicateKey: key,
      sourceOrder: index,
      name: field(name, name ? .8 : 0, line, pageFor(lines, index)),
      type: field(type, .9, line, pageFor(lines, index)),
      weight: field(weightMatch ? Number(weightMatch[1]) : null, weightMatch ? .95 : 0, line, pageFor(lines, index)),
      officialDeadline: field(isDeadline ? date : null, isDeadline && date ? .85 : 0, line, pageFor(lines, index)),
      eventDate: field(isEvent ? date : null, isEvent && date ? .85 : 0, line, pageFor(lines, index)),
      groupAssessment: field(/\bgroup\b/i.test(line) ? true : /\bindividual\b/i.test(line) ? false : null, .8, line, pageFor(lines, index)),
      submissionPlatform: field(line.match(/\b(?:NTULearn|Canvas|Blackboard|Moodle|Turnitin)\b/i)?.[0] || null, .85, line, pageFor(lines, index)),
      submissionUrl: field(line.match(/https:\/\/[^\s)]+/i)?.[0] || null, .95, line, pageFor(lines, index)),
      instructions: field(null, 0, line, pageFor(lines, index)),
      examFormat: field(line.match(/\b(?:open[- ]book|closed[- ]book|multiple[- ]choice|essay|written|oral)\b/i)?.[0] || null, .8, line, pageFor(lines, index)),
      durationMinutes: field(Number(line.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/i)?.[1]) || null, .85, line, pageFor(lines, index)),
      openBook: field(/\bopen[- ]book\b/i.test(line) ? true : /\bclosed[- ]book\b/i.test(line) ? false : null, .9, line, pageFor(lines, index)),
      deliverables: [], rubricHeadings: [], warnings: localWarnings
    })
  }

  const academicYear = facts.find(item => item.fieldName === 'academicYear')?.value
  const semester = facts.find(item => item.fieldName === 'semesterLabel')?.value
  const historical = Boolean((academicYear && activeAcademicYear && academicYear !== activeAcademicYear) || (semester && activeSemester && !semester.toLowerCase().includes(activeSemester.toLowerCase())))
  if (historical) warnings.push('The source appears historical or differs from the active semester.')
  const totalWeight = assessments.reduce((sum, item) => sum + (item.weight.value || 0), 0)
  if (totalWeight > 100) warnings.push('Assessment weights exceed 100%.')
  else if (assessments.length && totalWeight < 100) warnings.push('Assessment weights are incomplete.')
  if (!assessments.length) warnings.push('No assessment structure was confidently detected.')

  return {
    parserVersion: COURSE_OUTLINE_PARSER_VERSION,
    facts,
    assessments: assessments.map(({ duplicateKey, ...item }) => item),
    weeks,
    warnings: [...new Set([...warnings, ...assessments.flatMap(item => item.warnings)])],
    historical,
    academicYear: academicYear || null,
    semesterLabel: semester || null
  }
}
