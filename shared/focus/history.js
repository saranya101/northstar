import { SESSION_COMPLETION_STATES } from './timer.js'

export const HISTORY_RANGES = Object.freeze({
  ALL: 'ALL',
  TODAY: 'TODAY',
  WEEK: 'WEEK',
})

export const ALL_MODULES_FILTER = 'ALL'

function dateFrom(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfLocalDay(now = new Date()) {
  const date = dateFrom(now)
  if (!date) throw new TypeError('A valid date is required.')
  date.setHours(0, 0, 0, 0)
  return date
}

export function startOfCurrentLocalWeek(now = new Date(), weekStartsOn = 1) {
  const date = startOfLocalDay(now)
  const firstDay = Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6
    ? weekStartsOn
    : 1
  const daysSinceStart = (date.getDay() - firstDay + 7) % 7
  date.setDate(date.getDate() - daysSinceStart)
  return date
}

export function sessionModuleKey(session) {
  if (session?.moduleEnrolmentId) return `enrolment:${session.moduleEnrolmentId}`
  if (session?.moduleCode && session.moduleCode !== 'GENERAL') return `code:${session.moduleCode}`
  return 'general'
}

export function sessionModuleLabel(session) {
  if (!session?.moduleCode || session.moduleCode === 'GENERAL') return 'General study'
  return [session.moduleCode, session.moduleTitle].filter(Boolean).join(' · ')
}

export function isCountedStudySession(session) {
  return Number(session?.actualFocusedSeconds) > 0
}

export function filterFocusSessions(
  sessions,
  {
    moduleKey = ALL_MODULES_FILTER,
    range = HISTORY_RANGES.ALL,
    now = new Date(),
    weekStartsOn = 1,
  } = {},
) {
  const list = Array.isArray(sessions) ? sessions : []
  const current = dateFrom(now)
  if (!current) throw new TypeError('A valid current date is required.')
  const today = startOfLocalDay(current).getTime()
  const week = startOfCurrentLocalWeek(current, weekStartsOn).getTime()

  return list.filter((session) => {
    if (!isCountedStudySession(session)) return false
    if (moduleKey !== ALL_MODULES_FILTER && sessionModuleKey(session) !== moduleKey) return false

    const endedAt = dateFrom(session.endedAt)?.getTime()
    if (!Number.isFinite(endedAt)) return false
    if (range === HISTORY_RANGES.TODAY) return endedAt >= today
    if (range === HISTORY_RANGES.WEEK) return endedAt >= week
    return true
  })
}

export function summarizeFocusSessions(sessions, now = new Date(), weekStartsOn = 1) {
  const counted = (Array.isArray(sessions) ? sessions : []).filter(isCountedStudySession)
  const today = filterFocusSessions(counted, {
    range: HISTORY_RANGES.TODAY,
    now,
    weekStartsOn,
  })
  const week = filterFocusSessions(counted, {
    range: HISTORY_RANGES.WEEK,
    now,
    weekStartsOn,
  })
  const completedToday = today.filter(session => [
    SESSION_COMPLETION_STATES.COMPLETED,
    SESSION_COMPLETION_STATES.FINISHED_EARLY,
  ].includes(session.completionState))

  return {
    todayFocusedSeconds: today.reduce((sum, session) => sum + Number(session.actualFocusedSeconds || 0), 0),
    weekFocusedSeconds: week.reduce((sum, session) => sum + Number(session.actualFocusedSeconds || 0), 0),
    completedSessionsToday: completedToday.length,
    totalFocusedSeconds: counted.reduce((sum, session) => sum + Number(session.actualFocusedSeconds || 0), 0),
  }
}

export function groupFocusSessionsByModule(sessions) {
  const groups = new Map()

  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!isCountedStudySession(session)) continue
    const key = sessionModuleKey(session)
    const existing = groups.get(key) || {
      key,
      label: sessionModuleLabel(session),
      moduleCode: session.moduleCode || null,
      moduleTitle: session.moduleTitle || null,
      focusedSeconds: 0,
      sessionCount: 0,
    }

    existing.focusedSeconds += Number(session.actualFocusedSeconds || 0)
    existing.sessionCount += 1
    groups.set(key, existing)
  }

  return [...groups.values()].sort((left, right) =>
    right.focusedSeconds - left.focusedSeconds || left.label.localeCompare(right.label),
  )
}

export function recentFocusSessions(sessions, limit = 10) {
  return [...(Array.isArray(sessions) ? sessions : [])]
    .filter(isCountedStudySession)
    .sort((left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime())
    .slice(0, Math.max(0, Number(limit) || 0))
}
