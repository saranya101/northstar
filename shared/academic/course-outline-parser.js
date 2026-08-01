export const COURSE_OUTLINE_PARSER_VERSION = 'deterministic-3'

const LAYOUT_BLOCK = /\n?\[\[COURSE_OUTLINE_LAYOUT_V1\]\]\n([\s\S]*?)\n\[\[\/COURSE_OUTLINE_LAYOUT_V1\]\]\n?/g
const PAGE_MARKER = /^\[\[PAGE:(\d+)]]$/
const SECTION_PREFIX = '(?:[A-Z]\\s*[).:-]\\s*)?'
const ASSESSMENT_SECTION = new RegExp(`^${SECTION_PREFIX}(?:course\\s+assessments?|assessments?|assessment\\s+components?|assessment\\s+structure|grading\\s+scheme|grade\\s+breakdown|evaluation|modes?\\s+of\\s+assessment|continuous\\s+assessment)(?:\\s*\\([^)]*\\))?\\s*:?\\s*$`, 'i')
const STOP_SECTION = new RegExp(`^${SECTION_PREFIX}(?:detail\\s+for\\s+assessment\\s+components?|formative\\s+feedback|learning\\s+and\\s+teaching\\s+approach|course\\s+polic(?:y|ies)|readings?(?:\\s+and\\s+references)?|references|planned\\s+weekly\\s+schedule|course\\s+schedule|weekly\\s+schedule|rubrics?|appendix|academic\\s+integrity)(?:\\s*\\([^)]*\\))?\\s*:?\\s*$`, 'i')
const FORMAT = /\b(individual|team|group|pair|collaborative)\b/i
const DETAIL_SECTION = /^(?:[A-Z]\s*[).:-]\s*)?detail\s+for\s+assessment\s+components?\s*:?\s*$/i
const EXPLICIT_EXAM_FORMAT = /\b(open[- ]?book|closed[- ]?book|online|physical(?:ly)?|pen\s*(?:and|&|[-–])\s*paper|oral examination|viva)\b/gi

const ASSESSMENT_TYPES = [
  ['FINAL_EXAMINATION', /\b(final\s+exam(?:ination)?|end[- ]of[- ]semester exam)\b/i],
  ['MIDTERM', /\b(midterm|mid[- ]semester (?:exam|test))\b/i],
  ['QUIZ', /\b(?:quiz|mcq)\b/i],
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

function normalizeFragments(value) {
  return String(value || '')
    .replace(/\bparticipatio\s+n\b/gi, 'Participation')
    .replace(/\bpresentatio\s+n\b/gi, 'Presentation')
    .replace(/\bindivi\s+dual\b/gi, 'Individual')
    .replace(/\bi\s+ndividual\b/gi, 'Individual')
    .replace(/\binterperson\s+al\b/gi, 'Interpersonal')
    .replace(/\bclose\s+d\s+book\b/gi, 'closed book')
    .replace(/\bphysical\s+ly\b/gi, 'physically')
    .replace(/\b((?:19|20)\d)\s+(\d)\b/g, '$1$2')
    .replace(/(?<=\d)\s+(?=\d(?:\s*%|\s*[-–/*]\s*(?:19|20)\d))/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(input) {
  return String(input || '')
    .replace(LAYOUT_BLOCK, '\n')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => normalizeFragments(line))
    .filter(Boolean)
}

function readLayout(input) {
  const match = String(input || '').match(new RegExp(LAYOUT_BLOCK.source))
  if (!match) return []
  try {
    const pages = JSON.parse(match[1])
    if (!Array.isArray(pages)) return []
    return pages.map(page => ({
      pageNumber: Number(page.pageNumber) || null,
      items: Array.isArray(page.items)
        ? page.items.filter(item => typeof item?.text === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y)).map(item => ({
            text: normalizeFragments(item.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ')),
            x: Number(item.x),
            y: Number(item.y),
            width: Number.isFinite(item.width) ? Number(item.width) : null
          }))
        : []
    }))
  } catch {
    return []
  }
}

function pageFor(lines, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const match = lines[cursor].match(PAGE_MARKER)
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

function explicitExamFormat(value) {
  const source = normalizeFragments(value)
  const matches = [...source.matchAll(EXPLICIT_EXAM_FORMAT)].map(match => match[0].toLowerCase())
  const normalized = []
  if (matches.some(value => /closed/.test(value))) normalized.push('closed-book')
  else if (matches.some(value => /open/.test(value))) normalized.push('open-book')
  if (matches.some(value => value === 'online') || /\b(?:conducted|administered)\s+(?:online|on|through)\s+(?:NTULearn|Canvas|Blackboard|Moodle)|\bLockDown Browser\b/i.test(source)) normalized.push('Online')
  if (matches.some(value => /physical/.test(value))) normalized.push('Physical')
  if (matches.some(value => /pen/.test(value))) normalized.push('Pen-and-paper')
  if (matches.some(value => /oral examination|viva/.test(value))) normalized.push('Oral examination')
  return normalized.length ? normalized.join(', ') : null
}

function field(value, confidence, excerpt, pageNumber = null, sectionHeading = null) {
  return { value: value ?? null, confidence: value === null || value === undefined ? 0 : confidence, pageNumber, sectionHeading, sourceExcerpt: excerpt?.slice(0, 500) || null }
}

function labelledFact(lines, labels, key, result, confidence = .9) {
  if (result.some(item => item.fieldName === key)) return
  const exactLabel = new RegExp(`^(?:${labels.join('|')})\\s*$`, 'i')
  const pattern = new RegExp(`^(?:${labels.join('|')})\\s*(?::|–|-)?\\s+(.+)$`, 'i')
  const index = lines.findIndex(line => !exactLabel.test(line) && pattern.test(line))
  if (index < 0) return
  const match = lines[index].match(pattern)
  if (/^(?:&\s*)?scope$/i.test(match[1])) return
  result.push({ fieldName: key, ...field(match[1], confidence, lines[index], pageFor(lines, index)), sourceOrder: index })
}

function uniqueFact(result, fact) {
  if (fact?.value === null || fact?.value === undefined) return
  const existing = result.findIndex(item => item.fieldName === fact.fieldName)
  if (existing >= 0) result.splice(existing, 1, fact)
  else result.push(fact)
}

function inlineFacts(lines, result) {
  const definitions = [
    ['moduleCode', /\b(?:module|course)\s+code\s*:?\s*([A-Z]{2,}\s*\d{3,}[A-Z]?)\b/i, value => value.replace(/\s/g, '')],
    ['moduleTitle', /\b(?:module|course)\s+title\s*:?\s*(.+)$/i],
    ['academicUnits', /\b(?:no\.?\s+of\s+AUs?|academic\s+units?|AUs?|credits?)\s*:?\s*(\d+(?:\.\d+)?)\b/i],
    ['lecturer', /\b(?:course\s+coordinator|coordinator|lecturer)\s*:?\s*(.+)$/i],
    ['academicYear', /\bacademic\s+year\s*:?\s*((?:19|20)\d{2}\s*[-–/*]\s*(?:(?:19|20)?\d{2}))\b/i, value => value.replace(/\s/g, '').replace(/[-/*]/, '–')],
    ['semesterLabel', /\bsemester\s*:?\s*(\d+)\b/i, value => `Semester ${value}`]
  ]
  for (let index = 0; index < lines.length; index += 1) {
    for (const [fieldName, pattern, transform = value => value.trim()] of definitions) {
      const match = lines[index].match(pattern)
      if (!match) continue
      let value = transform(match[1])
      if (fieldName === 'moduleTitle') value = value.split(/\b(?:academic\s+year|semester|course\s+coordinator)\b/i)[0].trim()
      if (fieldName === 'lecturer') value = value.split(/\b(?:email|course\s+code|course\s+title|academic\s+units?|no\.?\s+of\s+AUs?)\b/i)[0].trim()
      uniqueFact(result, { fieldName, ...field(value, .9, lines[index], pageFor(lines, index)), sourceOrder: index })
    }
  }
  const headerIndex = lines.slice(0, 12).findIndex(line => /\b[A-Z]{2,}\d{3,}\b/.test(line))
  if (headerIndex >= 0) {
    const header = lines[headerIndex].match(/\b([A-Z]{2,}\d{3,}[A-Z]?)\s+(.+?)(?:\s+\((?:Semester|Sem|Term)|$)/i)
    if (header) {
      uniqueFact(result, { fieldName: 'moduleCode', ...field(header[1].toUpperCase(), .85, lines[headerIndex], pageFor(lines, headerIndex)), sourceOrder: headerIndex })
      uniqueFact(result, { fieldName: 'moduleTitle', ...field(header[2].trim(), .8, lines[headerIndex], pageFor(lines, headerIndex)), sourceOrder: headerIndex })
    }
  }
  const shortYearIndex = lines.findIndex(line => /\bAY\s*(?:19|20)\d{2}\s*[-/*]\s*\d{2}\b/i.test(line))
  if (shortYearIndex >= 0) {
    const match = lines[shortYearIndex].match(/\bAY\s*((?:19|20)\d{2})\s*[-/*]\s*(\d{2})\b/i)
    uniqueFact(result, { fieldName: 'academicYear', ...field(`${match[1]}–${match[1].slice(0, 2)}${match[2]}`, .85, lines[shortYearIndex], pageFor(lines, shortYearIndex)), sourceOrder: shortYearIndex })
  }
}

function rowsFor(items) {
  const rows = []
  for (const item of [...items].filter(item => item.text.trim()).sort((left, right) => Math.abs(right.y - left.y) > 3 ? right.y - left.y : left.x - right.x)) {
    let row = rows.find(value => Math.abs(value.y - item.y) <= 3)
    if (!row) { row = { y: item.y, items: [] }; rows.push(row) }
    row.items.push(item)
  }
  return rows
    .sort((left, right) => right.y - left.y)
    .map(row => ({ ...row, items: row.items.sort((left, right) => left.x - right.x), text: normalizeFragments(row.items.map(item => item.text).join(' ')) }))
}

function joinCell(items) {
  const lines = rowsFor(items).map(row => row.text)
  return normalizeFragments(lines.reduce((result, line) => {
    if (!result) return line
    return /^[a-z]$/i.test(line) && /[a-z]$/i.test(result) ? `${result}${line}` : `${result} ${line}`
  }, ''))
}

function assessmentRange(lines) {
  const start = lines.findIndex(line => ASSESSMENT_SECTION.test(line))
  if (start < 0) return null
  const relativeEnd = lines.slice(start + 1).findIndex(line => STOP_SECTION.test(line))
  return { start, end: relativeEnd < 0 ? lines.length : start + 1 + relativeEnd, heading: lines[start] }
}

function duplicateKey(name, type, weight, date) {
  return `${normalizeFragments(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}|${type || ''}|${weight ?? ''}|${date || ''}`
}

function candidateFrom({ name, weight = null, excerpt, pageNumber = null, sectionHeading = null, sourceOrder, format = null, confidence = .8 }) {
  const normalizedName = normalizeFragments(name)
    .replace(/^[-•*]\s*/, '')
    .replace(/^assessment\s*\d*\s*:\s*/i, '')
    .replace(/^\d+\s*[).:-]?\s*/, '')
    .replace(/\s*[*#]\s*$/, '')
    .trim() || null
  const normalizedExcerpt = normalizeFragments(excerpt)
  const localWarnings = []
  const dateMatch = normalizedExcerpt.match(DATE)
  const date = parseDate(dateMatch?.[0], localWarnings)
  const isDeadline = /\b(?:due|deadline|submit(?:ted|sion)?(?: by)?)\b/i.test(normalizedExcerpt)
  const isEvent = /\b(?:exam date|event date|held on|presentation date)\b/i.test(normalizedExcerpt)
  const explicitFormat = normalizeFragments(format || normalizedExcerpt).match(FORMAT)?.[1]?.toLowerCase() || null
  const groupAssessment = explicitFormat
    ? ['team', 'group', 'pair', 'collaborative'].includes(explicitFormat)
    : /\bgroup\b/i.test(normalizedExcerpt) ? true : /\bindividual\b/i.test(normalizedExcerpt) ? false : null
  let type = typeFor(normalizedName || normalizedExcerpt) || 'OTHER'
  if (groupAssessment === true && /\b(?:project|assignment|report)\b/i.test(normalizedName || normalizedExcerpt)) type = 'GROUP_ASSIGNMENT'
  else if (groupAssessment === false && /\bpresentation\b/i.test(normalizedName || normalizedExcerpt)) type = 'PRESENTATION'
  return {
    duplicateKey: duplicateKey(normalizedName, type, weight, date),
    sourceOrder,
    name: field(normalizedName, normalizedName ? confidence : 0, normalizedExcerpt, pageNumber, sectionHeading),
    type: field(type, type === 'OTHER' ? .55 : .9, normalizedExcerpt, pageNumber, sectionHeading),
    weight: field(weight, weight === null ? 0 : .95, normalizedExcerpt, pageNumber, sectionHeading),
    officialDeadline: field(isDeadline ? date : null, isDeadline && date ? .85 : 0, normalizedExcerpt, pageNumber, sectionHeading),
    eventDate: field(isEvent ? date : null, isEvent && date ? .85 : 0, normalizedExcerpt, pageNumber, sectionHeading),
    groupAssessment: field(groupAssessment, groupAssessment === null ? 0 : .9, normalizedExcerpt, pageNumber, sectionHeading),
    submissionPlatform: field(normalizedExcerpt.match(/\b(?:NTULearn|Canvas|Blackboard|Moodle|Turnitin)\b/i)?.[0] || null, .85, normalizedExcerpt, pageNumber, sectionHeading),
    submissionUrl: field(normalizedExcerpt.match(/https:\/\/[^\s)]+/i)?.[0] || null, .95, normalizedExcerpt, pageNumber, sectionHeading),
    instructions: field(null, 0, normalizedExcerpt, pageNumber, sectionHeading),
    examFormat: field(explicitExamFormat(normalizedExcerpt), .9, normalizedExcerpt, pageNumber, sectionHeading),
    durationMinutes: field(Number(normalizedExcerpt.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/i)?.[1]) || null, .85, normalizedExcerpt, pageNumber, sectionHeading),
    openBook: field(/\bopen[- ]book\b/i.test(normalizedExcerpt) ? true : /\bclosed[- ]book\b/i.test(normalizedExcerpt) ? false : null, .9, normalizedExcerpt, pageNumber, sectionHeading),
    deliverables: [],
    rubricHeadings: [],
    warnings: localWarnings
  }
}

function findColumns(items, rows, headingY, previous) {
  const belowHeading = items.filter(item => headingY === null || item.y < headingY + 3)
  const component = belowHeading.find(item => /^(?:(?:assessment|grading)\s+)?(?:component|item|task)$|^assessment$/i.test(item.text.trim()))
  const weighting = belowHeading.find(item => /^(?:weight(?:ing|age)?|percent(?:age)?|contribution|marks?)$/i.test(item.text.trim()))
  const format = belowHeading.find(item => /^(?:team\/?|team\/indivi|individual\/team|group\/individual|individual\s+(?:or|\/)\s+team|mode|format)$/i.test(item.text.trim()))
  if (!component || !weighting) return previous
  const headerY = Math.max(component.y, weighting.y, format?.y ?? -Infinity)
  const headerItems = belowHeading.filter(item => item.text.trim() && item.y <= headerY + 4 && item.y >= headerY - 45)
  const middleHeaders = headerItems.filter(item => item.x > component.x + 20 && item.x < weighting.x - 10)
  const nextNameColumn = Math.min(...middleHeaders.map(item => item.x))
  const rightHeaders = headerItems.map(item => item.x).filter(value => value > (format?.x ?? weighting.x) + 20)
  return {
    componentX: component.x,
    nameRight: Number.isFinite(nextNameColumn) ? (component.x + nextNameColumn) / 2 : weighting.x,
    weightX: weighting.x,
    formatX: format?.x ?? null,
    formatRight: rightHeaders.length ? ((format?.x ?? weighting.x) + Math.min(...rightHeaders)) / 2 : Infinity,
    headerY: Math.min(component.y, weighting.y, format?.y ?? component.y),
    sectionHeading: rows.find(row => ASSESSMENT_SECTION.test(row.text))?.text || previous?.sectionHeading || 'Assessments'
  }
}

function splitComponentName(rootName, format) {
  const group = /\b(?:team|group|pair|collaborative)\b/i.test(format)
  const individual = /\bindividual\b/i.test(format)
  if (group) return `${rootName} — Group component`
  if (individual && /\bpresentation\b/i.test(rootName)) return `${rootName} — Individual presentation component`
  if (individual) return `${rootName} — Individual component`
  return `${rootName} — Separate component`
}

function tableCandidates(rows, pageNumber, sectionHeading, orderStart) {
  const candidates = []
  let order = orderStart
  let group = []
  const flush = () => {
    if (!group.length) return
    const split = group.length > 1
    for (const row of group) {
      candidates.push(candidateFrom({
        name: split ? splitComponentName(row.rootName, row.format) : row.rootName,
        weight: row.weight,
        excerpt: row.excerpt,
        pageNumber,
        sectionHeading,
        sourceOrder: order++,
        format: row.format,
        confidence: .92
      }))
    }
    group = []
  }
  for (const row of rows) {
    if (row.explicitName) flush()
    if (!row.rootName) continue
    group.push(row)
  }
  flush()
  return { candidates, order }
}

function structuredAssessments(layout) {
  const candidates = []
  let active = false
  let columns = null
  let order = 0
  for (const page of layout) {
    const rows = rowsFor(page.items)
    const headingRow = rows.find(row => ASSESSMENT_SECTION.test(row.text))
    if (headingRow) active = true
    if (!active) continue
    const leftEdge = Math.min(...page.items.map(item => item.x))
    const stopRow = rows.find(row => STOP_SECTION.test(row.text) && row.items[0]?.x <= leftEdge + 30)
    const usableItems = page.items.filter(item => (!stopRow || item.y > stopRow.y + 3) && (!headingRow || item.y < headingRow.y - 3))
    const nextColumns = findColumns(usableItems, rows, headingRow?.y ?? null, columns)
    columns = nextColumns === columns && columns ? { ...columns, headerY: Infinity } : nextColumns
    if (!columns) {
      if (stopRow) active = false
      continue
    }
    const weightTolerance = columns.formatX
      ? Math.max(8, Math.min(30, Math.abs(columns.formatX - columns.weightX) * .3))
      : 18
    const totalRows = rows.filter(row => /^total\b/i.test(row.text))
    const tableBottom = totalRows.length ? Math.max(...totalRows.map(row => row.y)) : -Infinity
    const anchors = usableItems
      .filter(item => item.y < columns.headerY - 4 && Math.abs(item.x - columns.weightX) <= weightTolerance)
      .map(item => ({ item, match: item.text.trim().match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/) }))
      .filter(value => value.match && Number(value.match[1]) > 0 && Number(value.match[1]) <= 100)
      .filter(value => !totalRows.some(row => Math.abs(row.y - value.item.y) <= 4))
      .filter(value => value.item.y > tableBottom + 3)
      .sort((left, right) => right.item.y - left.item.y)
    const tableRows = []
    let currentRootName = null
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index]
      const firstGap = anchors[1] ? Math.abs(anchor.item.y - anchors[1].item.y) / 2 : 40
      const upper = index === 0
        ? Number.isFinite(columns.headerY) ? Math.min(columns.headerY - 3, anchor.item.y + firstGap) : anchor.item.y + firstGap
        : (anchors[index - 1].item.y + anchor.item.y) / 2
      const lower = index === anchors.length - 1
        ? Math.max(stopRow?.y ?? -Infinity, tableBottom + 3)
        : (anchor.item.y + anchors[index + 1].item.y) / 2
      const inBand = usableItems.filter(item => item.y < upper && item.y > lower)
      const nameItems = inBand.filter(item => item.x >= columns.componentX - 8 && item.x < columns.nameRight - 4)
      const name = joinCell(nameItems)
      const explicitName = Boolean(name && !/^(?:component|total)$/i.test(name))
      if (explicitName) currentRootName = name
      if (!currentRootName) continue
      const formatItems = columns.formatX === null ? [] : inBand.filter(item => item.x >= columns.formatX - 8 && item.x < columns.formatRight - 4)
      const format = joinCell(formatItems)
      const excerpt = joinCell(inBand)
      tableRows.push({ rootName: currentRootName, explicitName, weight: Number(anchor.match[1]), excerpt, format })
    }
    const parsed = tableCandidates(tableRows, page.pageNumber, columns.sectionHeading, order)
    candidates.push(...parsed.candidates)
    order = parsed.order
    if (stopRow || totalRows.length) active = false
  }
  return candidates
}

function plainAssessments(lines, sourceOrderOffset = 0) {
  const candidates = []
  const range = assessmentRange(lines)
  const start = range?.start ?? 0
  const end = range?.end ?? lines.length
  for (let index = start; index < end; index += 1) {
    const original = lines[index]
    if (PAGE_MARKER.test(original) || ASSESSMENT_SECTION.test(original)) continue
    let line = normalizeFragments(original)
    if (/\brubrics?\b|\bNBS learning goal\b/i.test(line)) continue
    let type = typeFor(line)
    let weightMatch = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*%/)
    if ((!type || !weightMatch) && index + 1 < end) {
      const nextLine = normalizeFragments(lines[index + 1])
      const nextStartsCandidate = /^[-•*]|\bassessment\s*\d*\s*:/i.test(nextLine)
      const combined = normalizeFragments(`${line} ${nextLine}`)
      const combinedType = typeFor(combined)
      const combinedWeight = combined.match(/\b(\d{1,3}(?:\.\d+)?)\s*%/)
      if (!nextStartsCandidate && !/^\s*total\b/i.test(nextLine) && combinedType && combinedWeight && (type || weightMatch || /^[-•*]|\bassessment\b/i.test(line))) {
        line = combined
        type = combinedType
        weightMatch = combinedWeight
      }
    }
    const hasDateLabel = /\b(?:due|deadline|exam date|event date)\b/i.test(line)
    const explicitListItem = /^[-•*]|\bassessment\s*\d*\s*:/i.test(line)
    if (!type || (!weightMatch && !hasDateLabel && !(range && explicitListItem))) continue
    if (/\btotal\s+\d{1,3}(?:\.\d+)?\s*%/i.test(line)) continue
    const segments = line.split(/\s*\|\s*|\s+[-–]\s+/)
    const name = segments[0].trim()
    candidates.push(candidateFrom({
      name,
      weight: weightMatch ? Number(weightMatch[1]) : null,
      excerpt: line,
      pageNumber: pageFor(lines, index),
      sectionHeading: range?.heading || null,
      sourceOrder: sourceOrderOffset + index,
      confidence: .8
    }))
  }
  return candidates
}

function mergeAssessments(primary, fallback) {
  const result = []
  const exact = new Set()
  for (const candidate of [...primary, ...fallback]) {
    const nameKey = normalizeFragments(candidate.name.value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const key = `${nameKey}|${candidate.weight.value ?? ''}`
    if (!nameKey || exact.has(key)) continue
    exact.add(key)
    result.push(candidate)
  }
  return result
}

function detailBlocks(lines) {
  const start = lines.findIndex(line => DETAIL_SECTION.test(line))
  if (start < 0) return []
  const endOffset = lines.slice(start + 1).findIndex(line => STOP_SECTION.test(line))
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset
  const headings = []
  for (let index = start + 1; index < end; index += 1) {
    const match = lines[index].match(/^\d+\s*[).]\s*(.+?)(?:\s*\([^)]*\b\d{1,3}\s*%[^)]*\))\s*$/i)
    if (match) headings.push({ index, name: normalizeFragments(match[1]) })
  }
  return headings.map((heading, index) => {
    const next = headings[index + 1]?.index ?? end
    return {
      ...heading,
      excerpt: normalizeFragments(lines.slice(heading.index, next).join(' ')),
      pageNumber: pageFor(lines, heading.index)
    }
  })
}

function assessmentRootName(value) {
  return normalizeFragments(value)
    .replace(/\s+—\s+(?:Group|Individual presentation|Individual|Separate) component$/i, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function weekTiming(value) {
  const match = normalizeFragments(value).match(/\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+of)?\s+Week\s+\d{1,2})\s+(?:at|,)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|[-–])\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)
  return match ? `${match[1]}; ${clockTime(match[2])}–${clockTime(match[3])}` : null
}

function clockTime(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  return match ? `${match[1]}:${match[2] || '00'} ${match[3].toUpperCase()}` : value
}

function enrichAssessmentsFromDetails(assessments, lines) {
  const blocks = detailBlocks(lines)
  for (const block of blocks) {
    const blockKey = assessmentRootName(block.name)
    const related = assessments.filter(candidate => {
      const candidateKey = assessmentRootName(candidate.name.value)
      return candidateKey === blockKey || candidateKey.includes(blockKey) || blockKey.includes(candidateKey)
    })
    if (!related.length) continue
    for (const candidate of related) {
      const examFormat = explicitExamFormat(block.excerpt)
      if (examFormat) candidate.examFormat = field(examFormat, .9, block.excerpt, block.pageNumber, 'Detail for Assessment Components')
      const openBook = /\bopen[- ]book\b/i.test(block.excerpt) ? true : /\bclosed[- ]book\b/i.test(block.excerpt) ? false : null
      if (openBook !== null) candidate.openBook = field(openBook, .9, block.excerpt, block.pageNumber, 'Detail for Assessment Components')
      const platform = block.excerpt.match(/\b(?:conducted|administered|submitted|submission|upload(?:ed)?)\b[^.]{0,100}\b(NTULearn|Canvas|Blackboard|Moodle|Turnitin)\b/i)?.[1] || null
      if (platform) candidate.submissionPlatform = field(platform, .85, block.excerpt, block.pageNumber, 'Detail for Assessment Components')
      const timing = weekTiming(block.excerpt)
      if (timing) candidate.instructions = field(timing, .9, block.excerpt, block.pageNumber, 'Detail for Assessment Components')
    }
  }
  return assessments
}

function structuredWeeks(layout) {
  const weeks = []
  let order = 0
  for (const page of layout) {
    const rows = rowsFor(page.items)
    const heading = rows.find(row => /^(?:[A-Z]\s*[).:-]\s*)?planned\s+weekly\s+schedule\s*$/i.test(row.text))
    if (!heading) continue
    const headers = page.items.filter(item => item.y < heading.y && item.y > heading.y - 70)
    const weekHeader = headers.find(item => /^week$/i.test(item.text.trim()))
    const topicHeader = headers.find(item => /^topic$/i.test(item.text.trim()))
    const iloHeader = headers.find(item => /^(?:ILO|learning outcomes?)$/i.test(item.text.trim()))
    const readingHeader = headers.find(item => /^readings?(?:\s*\/\s*activities)?$/i.test(item.text.trim()))
    if (!weekHeader || !topicHeader || !iloHeader || !readingHeader) continue
    const finalLabel = rows.find(row => /^final\s+examination$/i.test(row.text))
    const anchors = rows
      .filter(row => row.y < Math.min(weekHeader.y, topicHeader.y) - 3)
      .map(row => ({ row, number: Number(row.items.filter(item => Math.abs(item.x - weekHeader.x) <= 22).map(item => item.text).join('').replace(/\s/g, '')) }))
      .filter(value => Number.isInteger(value.number) && value.number >= 1 && value.number <= 60)
      .sort((left, right) => right.row.y - left.row.y)
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index]
      const upper = anchor.row.y + 9
      const lower = anchors[index + 1] ? anchors[index + 1].row.y + 9 : (finalLabel?.y ?? -Infinity)
      const items = page.items.filter(item => item.y <= upper && item.y > lower)
      const topic = joinCell(items.filter(item => item.x >= topicHeader.x - 8 && item.x < iloHeader.x - 8))
        .replace(/\bRECESS WEEK\b/gi, '').replace(/\bFINAL EXAMINATION\b/gi, '').trim() || null
      const reading = joinCell(items.filter(item => item.x >= readingHeader.x - 8)).trim() || null
      const scheduleText = joinCell(items)
      const assessmentReference = scheduleText.match(/\b(?:quiz|test|exam(?:ination)?|presentation|project|assignment)\b[^|]{0,100}/i)?.[0] || null
      weeks.push({
        weekNumber: anchor.number,
        topic,
        reading,
        activity: assessmentReference,
        importantDate: weekTiming(scheduleText) || (() => {
          const match = scheduleText.match(/\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?)\b\s*,?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)
          return match ? `${match[1]}; ${clockTime(match[2])}–${clockTime(match[3])}` : null
        })(),
        sourceOrder: order++,
        pageNumber: page.pageNumber,
        sourceExcerpt: scheduleText.slice(0, 500),
        confidence: .9
      })
    }
  }
  return weeks
}

function academicYearKey(value) {
  const match = String(value || '').match(/((?:19|20)\d{2})\D+(\d{2,4})/)
  if (!match) return normalizeFragments(value).toLowerCase()
  const end = match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]
  return `${match[1]}-${end}`
}

export function parseCourseOutline(input, { activeAcademicYear, activeSemester } = {}) {
  const lines = clean(input)
  const layout = readLayout(input)
  const warnings = []
  const facts = []
  const weeks = structuredWeeks(layout)

  inlineFacts(lines, facts)
  labelledFact(lines, ['module code', 'course code'], 'moduleCode', facts)
  labelledFact(lines, ['module title', 'course title'], 'moduleTitle', facts)
  labelledFact(lines, ['academic units?', 'AU', 'credits?'], 'academicUnits', facts)
  labelledFact(lines, ['course description', 'module description', 'description'], 'description', facts, .8)
  labelledFact(lines, ['learning outcomes?', 'course learning outcomes?'], 'learningOutcomes', facts, .8)
  labelledFact(lines, ['lecturer', 'course coordinator'], 'lecturer', facts)
  labelledFact(lines, ['tutor'], 'tutor', facts)
  labelledFact(lines, ['consultation(?: details| hours)?'], 'consultationDetails', facts)
  labelledFact(lines, ['teaching weeks?'], 'teachingWeeks', facts)
  labelledFact(lines, ['attendance requirement'], 'attendanceRequirement', facts)
  labelledFact(lines, ['participation requirement'], 'participationRequirement', facts)
  labelledFact(lines, ['academic integrity', 'academic honesty'], 'academicIntegrityNotes', facts)
  labelledFact(lines, ['academic year'], 'academicYear', facts)
  labelledFact(lines, ['semester', 'term'], 'semesterLabel', facts)
  inlineFacts(lines, facts)

  if (!weeks.length) {
    for (let index = 0; index < lines.length; index += 1) {
      const week = lines[index].match(/^week\s*(\d{1,2})\s*[:|–-]\s*(.+)$/i)
      if (!week) continue
      const columns = week[2].split(/\s*\|\s*/)
      weeks.push({ weekNumber: Number(week[1]), topic: columns[0] || null, reading: columns[1] || null, activity: columns[2] || null, importantDate: columns[3] || null, sourceOrder: index, pageNumber: pageFor(lines, index), sourceExcerpt: lines[index].slice(0, 500), confidence: .85 })
    }
  }

  const structured = structuredAssessments(layout)
  const assessments = enrichAssessmentsFromDetails(structured.length ? mergeAssessments(structured, []) : mergeAssessments([], plainAssessments(lines)), lines)
  const academicYear = facts.find(item => item.fieldName === 'academicYear')?.value
  const semester = facts.find(item => item.fieldName === 'semesterLabel')?.value
  const historical = Boolean((academicYear && activeAcademicYear && academicYearKey(academicYear) !== academicYearKey(activeAcademicYear)) || (semester && activeSemester && !semester.toLowerCase().includes(activeSemester.toLowerCase())))
  if (historical) warnings.push('The source appears historical or differs from the active semester.')
  const totalWeight = assessments.reduce((sum, item) => sum + (item.weight.value || 0), 0)
  if (totalWeight > 100) warnings.push('Assessment weights exceed 100%.')
  else if (assessments.length && totalWeight < 100) warnings.push('Assessment weights are incomplete.')
  if (!assessments.length) warnings.push('No assessment structure was confidently detected.')

  return {
    parserVersion: COURSE_OUTLINE_PARSER_VERSION,
    facts,
    assessments: assessments.map(({ duplicateKey: ignored, ...item }) => item),
    weeks,
    warnings: [...new Set([...warnings, ...assessments.flatMap(item => item.warnings)])],
    historical,
    academicYear: academicYear || null,
    semesterLabel: semester || null
  }
}
