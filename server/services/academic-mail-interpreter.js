import { parseOpportunityDateFragment } from './opportunity-text-parser'

const MODULE = /\b[A-Z]{2,4}\d{4}\b/
const BOILERPLATE = /\b(any multimedia items must be viewed online|view announcement|notification preferences?|confidentiality notice|email brought to you by|unsubscribe|do not reply to this automated|privileged and confidential)\b/i
const ACTION = /\b(action required|you (?:are required to|must)\s+(?:submit|complete|respond|register|upload|acknowledge)|shortlisted candidates are required to|(?:we would like to )?invite you to complete (?:a |the )?(?:case )?assessment|interview invitation|assessment invitation|please\s+(?:submit|complete|respond|register|upload|acknowledge)|(?:submit|complete|respond|register|upload)\s+by\b|(?:submit|complete|respond|register|upload)\s+(?:the\s+|your\s+)?[^.]{0,80}\s+by\b)/i
const DEADLINE = /\b(deadline|due by|submit(?:\s+(?:the\s+|your\s+)?[^.]{0,80})?\s+by|complete(?:\s+(?:the\s+|your\s+)?[^.]{0,80})?\s+by|respond by|register by|upload by|apply by)\b/i
const SELECTION_STAGE = /\b(selection process|case assessment|assessment invitation|interview invitation|shortlisted candidates are required to)\b/i
const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 }

const clean = value => value?.replace(/^[\s:*#–—-]+|[\s:;|]+$/g, '').replace(/[ \t]+/g, ' ').trim() || null
const lines = text => String(text || '').replace(/\r/g, '').split('\n').map(clean).filter(Boolean)

export function withoutAcademicBoilerplate(text) {
  return lines(text).filter(line => !BOILERPLATE.test(line)).join('\n')
}

function dateOnly(text, subject) {
  const explicit = text.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(20\d{2})\b/i)
  let day = explicit?.[1]
  let monthName = explicit?.[2]
  let year = explicit?.[3]
  if (!explicit) {
    const partial = text.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i)
    const academicYear = subject?.match(/\bAY\s*(\d{2})\s*[/–-]\s*(\d{2})\b/i)
    if (!partial || !academicYear) return null
    day = partial[1]; monthName = partial[2]
    const month = MONTHS[monthName.toLowerCase()]
    year = `20${month >= 8 ? academicYear[1] : academicYear[2]}`
  }
  const month = MONTHS[monthName.toLowerCase()]
  const date = new Date(Date.UTC(Number(year), month - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== Number(day)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function announcementTitle(subject) {
  if (!subject) return null
  let value = subject.replace(/^.*?:\s*/, '')
  value = value.replace(/^\s*[A-Z]{2,4}\d{4}\s+(?:Group|G(?:rp)?)\s*\w+\s*[-–—:]\s*/i, '')
  value = value.replace(/\s+on\s+\d{1,2}\s+[A-Za-z]+(?:\s+20\d{2})?(?:\s*\([^)]+\))?\s*$/i, '')
  return clean(value) || subject
}

function selectionOrganisation(sourceLines) {
  const labelled = sourceLines.find(line => /^(?:organisation|organization)\s*[:–-]/i.test(line))
  if (labelled) return clean(labelled.replace(/^(?:organisation|organization)\s*[:–-]\s*/i, ''))
  const signoff = sourceLines.findIndex(line => /^(?:best\s+)?regards|^sincerely/i.test(line))
  const candidate = signoff >= 0 ? sourceLines[signoff + 1] : null
  return candidate && /\b(?:club|society|office|association|capital|bank|university)\b/i.test(candidate) ? candidate : null
}

function selectionTitle(combined) {
  const portfolio = combined.match(/\bIBC\s+S\s*&\s*T\s+Portfolio\b/i)?.[0]
    || combined.match(/\b[A-Z][A-Za-z0-9& ]{1,70}\s+Portfolio\b/)?.[0]
  if (!portfolio || !/\b(?:case )?assessment\b/i.test(combined)) return null
  return `${clean(portfolio.replace(/\s+/g, ' '))} — Case Assessment`
}

function subtype(text, requiresAction, resources) {
  if (requiresAction) return 'REQUIRED_ACTION'
  if (/\bvenue\s+(?:change|changed|update)|(?:moved|relocated)\s+(?:from|to)\b/i.test(text)) return 'VENUE_CHANGE'
  if (/\b(class|lesson|seminar|tutorial|lecture)\b.*\b(rescheduled|cancelled|postponed|changed)\b/i.test(text)) return 'CLASS_CHANGE'
  if (/\b(final\s+)?exam(?:ination)?\b/i.test(text)) return 'EXAM_NOTICE'
  if (/\b(assessment|quiz|assignment|project|presentation)\b/i.test(text)) return 'ASSESSMENT_NOTICE'
  if (/\b(class|lesson|seminar|tutorial|lecture|professional etiquette|power dressing)\b/i.test(text)) return 'CLASS_INFORMATION'
  if (resources.length && !MODULE.test(text)) return 'RESOURCE'
  if (/\bannouncement\b/i.test(text)) return 'MODULE_ANNOUNCEMENT'
  return 'GENERAL_ACADEMIC'
}

function resourcesFrom(text) {
  const result = []
  const seen = new Set()
  for (const line of lines(text)) {
    const url = line.match(/https?:\/\/[^\s<>()"']+/i)?.[0]?.replace(/[.,;!?]+$/, '') || null
    const file = line.match(/([^:\n]{2,220}\.(?:xlsx?|docx?|pdf|pptx?|csv|zip))\b/i)?.[1]
    const label = clean(file || (url ? line.replace(url, '').replace(/^Referenced links:?$/i, '') : null))
    if (!url && !file) continue
    const key = url || file.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const context = `${label || ''} ${url || ''}`
    const type = /\battachment\b/i.test(line) ? 'ATTACHMENT' : /\bmap|direction/i.test(context) ? 'MAP' : /\bform/i.test(context) ? 'FORM' : /\bannouncement/i.test(context) ? 'ANNOUNCEMENT' : file ? 'DOCUMENT' : 'EXTERNAL_RESOURCE'
    result.push({ label: label || url, url, type })
  }
  return result.slice(0, 30)
}

export function interpretAcademicMail(rawText, metadata = {}) {
  const relevant = withoutAcademicBoilerplate(rawText)
  const sourceLines = lines(relevant)
  const combined = `${metadata.subject || ''}\n${relevant}`
  const moduleCode = combined.match(MODULE)?.[0] || null
  const actionLine = sourceLines.find(line => ACTION.test(line)) || null
  const selectionStage = SELECTION_STAGE.test(combined) ? (/\b(?:case )?assessment\b/i.test(combined) ? 'ASSESSMENT' : 'SELECTION') : null
  const actionRequired = selectionStage === 'ASSESSMENT' && actionLine && /\bsubmit\b/i.test(combined)
    ? 'Complete and submit case assessment'
    : actionLine
  const requiresAction = Boolean(actionLine)
  const deadlineLine = requiresAction ? sourceLines.find(line => DEADLINE.test(line) && parseOpportunityDateFragment(line)) || null : null
  const exactDeadline = deadlineLine ? parseOpportunityDateFragment(deadlineLine) : null
  const eventLine = sourceLines.find(line => /\b(class|lesson|seminar|tutorial|lecture|date)\b/i.test(line) && /\b\d{1,2}\s+[A-Za-z]{3,9}\b/.test(line)) || metadata.subject || ''
  const eventDate = dateOnly(eventLine, metadata.subject) || dateOnly(metadata.subject || '', metadata.subject)
  const timeLine = sourceLines.find(line => /\b(?:time|class|lesson|seminar|tutorial|lecture)\b/i.test(line) && /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?/i.test(line))
  const time = timeLine?.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i)
  const venueLine = sourceLines.find(line => /^(?:venue|location)\s*[:–-]/i.test(line))
  const venue = clean(venueLine?.replace(/^(?:venue|location)\s*[:–-]\s*/i, ''))
  const resources = resourcesFrom(rawText)
  const evidence = sourceLines.filter(line => !BOILERPLATE.test(line) && (MODULE.test(line) || line === actionLine || line === deadlineLine || line === venueLine || /\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\b/.test(line) || /\.(?:xlsx?|docx?|pdf|pptx?)\b|https?:\/\//i.test(line))).slice(0, 12)
  return {
    title: selectionTitle(combined) || announcementTitle(metadata.subject) || sourceLines.find(line => !/^(?:from|to|sent|subject):/i.test(line)) || 'Academic announcement',
    organisation: selectionStage ? selectionOrganisation(sourceLines) : null,
    selectionStage,
    moduleCode,
    academicSubtype: subtype(combined, requiresAction, resources),
    eventDate,
    eventStartTime: clean(time?.[1]),
    eventEndTime: clean(time?.[2]),
    venue,
    actionRequired,
    requiresAction,
    exactDeadline,
    deadline: exactDeadline,
    deadlineSourceText: deadlineLine,
    resources,
    sourceLinks: resources.filter(resource => resource.url).map(resource => ({ label: resource.label, url: resource.url })),
    evidence,
    sourceText: rawText
  }
}
