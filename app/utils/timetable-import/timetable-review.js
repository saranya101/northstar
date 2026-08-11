import { timetableStructureIssues } from '~~/shared/utils/timetable-structure'
import { findTimetableConflicts, overlappingWeekNumbers } from './timetable-conflicts'
import { formatMinutes } from './timetable-time'

const GROUP_FIELDS = ['classType', 'groupLabel', 'dayOfWeek', 'startMinutes', 'endMinutes']

export function cloneReviewModules(value) {
  return JSON.parse(JSON.stringify(value || []))
}

export function applyPublicEnrichmentSuggestion(module, value, useSuggestion = true) {
  if (!value?.available) {
    module.publicEnrichmentConfirmed = true
    module.titleNeedsReview = false
    return module
  }
  if (useSuggestion) {
    if (value.title) module.title = value.title
    if (value.academicUnits !== null && value.academicUnits !== undefined) module.academicUnits = value.academicUnits
  }
  module.publicEnrichment = {
    title: value.title, academicUnits: value.academicUnits, description: value.description, gradingBasis: value.gradingBasis,
    school: value.school, officialUrl: value.officialUrl, fieldProvenance: value.fieldProvenance, verificationStatus: value.verificationStatus
  }
  module.publicEnrichmentConfirmed = true
  module.titleNeedsReview = false
  return module
}

export function sessionIssueFields(session) {
  if (!session?.selected) return []
  const issues = []
  if (session.moduleAssignmentConfirmed === false) issues.push({ field: 'moduleCode', label: 'Choose the registered module for this class block' })
  if (!session.dayOfWeek) issues.push({ field: 'dayOfWeek', label: 'Choose a weekday' })
  if (session.startMinutes === null) issues.push({ field: 'startMinutes', label: 'Enter a start time' })
  if (session.endMinutes === null || (session.startMinutes !== null && session.endMinutes <= session.startMinutes)) issues.push({ field: 'endMinutes', label: session.endMinutes === null ? 'Enter an end time' : 'Fix the end time' })
  if (session.startMinutes !== null && session.endMinutes !== null && session.endMinutes > session.startMinutes && session.timeConfirmed === false) issues.push({ field: 'startMinutes', label: session.timeAlternatives?.length ? 'Choose a detected time' : 'Confirm the detected time' })
  if (!session.deliveryModeConfirmed) issues.push({ field: 'deliveryMode', label: 'Confirm the delivery mode' })
  if (!session.recurrenceConfirmed) issues.push({ field: 'recurrence', label: 'Confirm the week pattern' })
  return issues
}

export function issueTargetId(sessionCandidateId, field) {
  return `review-${sessionCandidateId}-${field}`
}

export function revealReviewIssue(expandedModules, expandedSessions, issue) {
  expandedModules.add(issue.moduleCandidateId)
  if (issue.sessionCandidateId) expandedSessions.add(issue.sessionCandidateId)
  return issue.targetId
}

export function reviewIssues(modules = [], draft = {}) {
  const selectedSessions = modules.filter(module => module.selected).flatMap(module => module.sessions.filter(session => session.selected).map(session => ({ ...session, code: module.code, moduleCandidateId: module.candidateId })))
  const conflictIssues = findTimetableConflicts(selectedSessions).map(({ first, second }, index) => {
    const weeks = overlappingWeekNumbers(first, second)
    const weekLabel = weeks.length >= 20 ? 'weekly overlap' : `weeks ${weeks.join(', ')}`
    return {
      id: `conflict-${first.candidateId}-${second.candidateId}-${index}`,
      moduleCandidateId: first.moduleCandidateId,
      sessionCandidateId: first.candidateId,
      field: 'conflict',
      label: `${first.code} conflicts with ${second.code}`,
      context: `${first.dayOfWeek} ${formatMinutes(first.startMinutes)}–${formatMinutes(first.endMinutes)} · ${weekLabel}`,
      targetId: `review-${first.candidateId}-conflict`
    }
  })
  return timetableStructureIssues(modules, draft).concat(conflictIssues, modules.flatMap((module) => {
    if (!module.selected) return []
    const moduleIssues = []
    if (!String(module.code || '').trim()) moduleIssues.push({ id: `${module.candidateId}-code`, moduleCandidateId: module.candidateId, sessionCandidateId: null, field: 'code', label: 'Enter the module code', context: module.title || 'Module', targetId: `review-${module.candidateId}-code` })
    if (!String(module.title || '').trim()) moduleIssues.push({ id: `${module.candidateId}-title`, moduleCandidateId: module.candidateId, sessionCandidateId: null, field: 'title', label: 'Enter the module title', context: module.code || 'Module', targetId: `review-${module.candidateId}-title` })
    if (module.publicEnrichmentConfirmed === false) moduleIssues.push({
      id: `${module.candidateId}-publicEnrichment`, moduleCandidateId: module.candidateId, sessionCandidateId: null,
      field: 'publicEnrichment', label: 'Resolve the public-source discrepancy', context: module.code,
      targetId: `review-${module.candidateId}-publicEnrichment`
    })
    return moduleIssues.concat(module.sessions.flatMap(session => sessionIssueFields(session).map((issue, index) => ({
      id: `${session.candidateId}-${issue.field}-${index}`,
      moduleCandidateId: module.candidateId,
      sessionCandidateId: session.candidateId,
      field: issue.field,
      label: issue.label,
      context: [module.code, session.classType, session.groupLabel, session.dayOfWeek].filter(Boolean).join(' · '),
      targetId: issueTargetId(session.candidateId, issue.field)
    }))))
  }))
}

export function moduleIssueCount(module) {
  return reviewIssues([module]).length
}

export function initialExpandedModuleIds(modules = [], draft = {}) {
  return [...new Set(reviewIssues(modules, draft).map(issue => issue.moduleCandidateId).filter(Boolean))]
}

export function initialExpandedSessionIds(modules = [], draft = {}) {
  return [...new Set(reviewIssues(modules, draft).map(issue => issue.sessionCandidateId).filter(Boolean))]
}

export function formatWeekRanges(weekNumbers = []) {
  const values = [...new Set(weekNumbers)].filter(Number.isInteger).sort((left, right) => left - right)
  const ranges = []
  for (const value of values) {
    const last = ranges.at(-1)
    if (last && value === last[1] + 1) last[1] = value
    else ranges.push([value, value])
  }
  return ranges.map(([start, end]) => start === end ? `${start}` : `${start}–${end}`).join(', ')
}

export function compactSessionParts(session = {}) {
  const day = session.dayOfWeek ? `${session.dayOfWeek.slice(0, 1)}${session.dayOfWeek.slice(1, 3).toLowerCase()}` : 'Day missing'
  const start = formatMinutes(session.startMinutes)
  const end = formatMinutes(session.endMinutes)
  const time = start && end ? `${start}–${end}` : 'Time missing'
  const venue = session.deliveryMode === 'ONLINE' && (!session.venue || session.venue.toUpperCase() === 'ONLINE') ? 'Online' : session.venue
  const weeks = session.recurrence === 'CUSTOM' ? formatWeekRanges(session.weekNumbers) : ''
  return [day, time, venue, weeks ? `Weeks ${weeks}` : null].filter(Boolean)
}

export function groupReviewSessions(sessions = []) {
  const groups = new Map()
  for (const session of sessions) {
    const key = JSON.stringify(GROUP_FIELDS.map(field => session[field] ?? null))
    if (!groups.has(key)) groups.set(key, { key, sessions: [], candidateIds: [], classType: session.classType, groupLabel: session.groupLabel, dayOfWeek: session.dayOfWeek, startMinutes: session.startMinutes, endMinutes: session.endMinutes })
    const group = groups.get(key)
    group.sessions.push(session)
    group.candidateIds.push(session.candidateId)
  }
  return [...groups.values()]
}

export function canConfirmReview(modules, unresolvedCount, semesterStatus) {
  return modules.some(module => module.selected) && unresolvedCount === 0 && semesterStatus === 'MATCH'
}
