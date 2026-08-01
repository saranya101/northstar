export const PLANNER_STORAGE_VERSION = 1
export const STUDY_BLOCK_STATUSES = Object.freeze(['PLANNED', 'COMPLETED', 'SKIPPED'])
export const WEEKDAY_KEYS = Object.freeze(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function text(value, maximum) {
  const result = typeof value === 'string' ? value.trim() : ''
  return result ? result.slice(0, maximum) : null
}

function integer(value) {
  const result = Number(value)
  return Number.isInteger(result) ? result : null
}

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((item, index) => index === 0 ? String(item) : String(item).padStart(2, '0'))
    .join('-')
}

export function localDateFromKey(value) {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  return localDateKey(date) === value ? date : null
}

export function startOfLocalWeek(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return date
}

export function addLocalDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  date.setDate(date.getDate() + Number(days || 0))
  return date
}

export function weekDateKeys(weekStart) {
  const start = startOfLocalWeek(weekStart)
  return start ? WEEKDAY_KEYS.map((day, index) => ({ day, date: addLocalDays(start, index), dateKey: localDateKey(addLocalDays(start, index)) })) : []
}

export function parseClockTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatClockTime(value) {
  const minutes = integer(value)
  if (minutes === null || minutes < 0 || minutes > 1440) return ''
  const safe = Math.min(minutes, 1439)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function validateStudyBlockInput(input = {}) {
  const errors = {}
  const title = text(input.title, 160)
  const date = localDateFromKey(input.date)
  const startMinutes = integer(input.startMinutes ?? parseClockTime(input.startTime))
  const endMinutes = integer(input.endMinutes ?? parseClockTime(input.endTime))
  const status = STUDY_BLOCK_STATUSES.includes(input.status) ? input.status : 'PLANNED'

  if (!title) errors.title = 'Enter a study-block title.'
  if (!date) errors.date = 'Choose a valid local date.'
  if (startMinutes === null || startMinutes < 0 || startMinutes >= 1440) errors.startTime = 'Choose a valid start time.'
  if (endMinutes === null || endMinutes <= 0 || endMinutes > 1440) errors.endTime = 'Choose a valid end time.'
  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) errors.endTime = 'End time must be after start time.'

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      date: date ? localDateKey(date) : null,
      startMinutes,
      endMinutes,
      goal: text(input.goal, 500),
      status,
      enrolmentId: text(input.enrolmentId, 200),
      moduleCode: text(input.moduleCode, 40),
      moduleTitle: text(input.moduleTitle, 200),
      assessmentId: text(input.assessmentId, 200),
    },
  }
}

export function createStudyBlock(input, { userId, id, now = new Date() } = {}) {
  const validation = validateStudyBlockInput(input)
  if (!validation.valid) return { block: null, errors: validation.errors }
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString()
  return {
    errors: {},
    block: {
      id: String(id || `study-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 200),
      userId: String(userId || '').slice(0, 200),
      ...validation.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

export function sanitizeStudyBlock(value, userId) {
  if (!value || typeof value !== 'object' || String(value.userId || '') !== String(userId || '')) return null
  const validation = validateStudyBlockInput(value)
  if (!validation.valid || !text(value.id, 200)) return null
  const createdAt = new Date(value.createdAt)
  const updatedAt = new Date(value.updatedAt)
  return {
    id: text(value.id, 200),
    userId: String(userId),
    ...validation.value,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0).toISOString() : createdAt.toISOString(),
    updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date(0).toISOString() : updatedAt.toISOString(),
  }
}

export function blockDurationMinutes(block) {
  const start = integer(block?.startMinutes)
  const end = integer(block?.endMinutes)
  return start === null || end === null ? 0 : Math.max(0, end - start)
}

export function intervalsOverlap(left, right) {
  return Boolean(left && right && left.date === right.date && left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes)
}

export function studyBlockConflicts(candidate, studyBlocks = [], classOccurrences = [], ignoreId = candidate?.id) {
  if (!candidate) return []
  const conflicts = []
  for (const block of studyBlocks) {
    if (block.id === ignoreId || !intervalsOverlap(candidate, block)) continue
    conflicts.push({ kind: 'STUDY_BLOCK', id: block.id, label: block.title, startMinutes: block.startMinutes, endMinutes: block.endMinutes })
  }
  for (const session of classOccurrences) {
    if (!intervalsOverlap(candidate, session)) continue
    conflicts.push({ kind: 'CLASS_SESSION', id: session.id, label: [session.module?.code, session.classType].filter(Boolean).join(' · ') || 'Class session', startMinutes: session.startMinutes, endMinutes: session.endMinutes })
  }
  return conflicts.sort((left, right) => left.startMinutes - right.startMinutes || left.label.localeCompare(right.label))
}

function teachingWeekNumber(weekStart, teachingStartDate) {
  const teachingStart = teachingStartDate ? startOfLocalWeek(new Date(teachingStartDate)) : null
  if (!teachingStart || Number.isNaN(teachingStart.getTime())) return null
  return Math.floor((startOfLocalWeek(weekStart).getTime() - teachingStart.getTime()) / (7 * DAY_MS)) + 1
}

export function classSessionOccursInWeek(session, weekStart, activeSemester = {}) {
  const dates = weekDateKeys(weekStart)
  const day = dates.find(item => item.day === session?.dayOfWeek)
  if (!day) return false

  const teachingStart = activeSemester.teachingStartDate ? localDateKey(new Date(activeSemester.teachingStartDate)) : null
  const teachingEnd = activeSemester.teachingEndDate ? localDateKey(new Date(activeSemester.teachingEndDate)) : null
  if (teachingStart && day.dateKey < teachingStart) return false
  if (teachingEnd && day.dateKey > teachingEnd) return false

  const weekNumber = teachingWeekNumber(weekStart, activeSemester.teachingStartDate)
  if (weekNumber === null) return true
  if (session.recurrence === 'ODD_WEEKS') return weekNumber > 0 && weekNumber % 2 === 1
  if (session.recurrence === 'EVEN_WEEKS') return weekNumber > 0 && weekNumber % 2 === 0
  if (session.recurrence === 'CUSTOM') return Array.isArray(session.weekNumbers) && session.weekNumbers.includes(weekNumber)
  return weekNumber > 0
}

export function classOccurrencesForWeek(timetable, weekStart) {
  const days = weekDateKeys(weekStart)
  const activeSemester = timetable?.activeSemester || {}
  return (timetable?.sessions || [])
    .filter(session => classSessionOccursInWeek(session, weekStart, activeSemester))
    .map((session) => {
      const day = days.find(item => item.day === session.dayOfWeek)
      return { ...session, date: day?.dateKey || null, fixed: true }
    })
    .filter(session => session.date && Number.isInteger(session.startMinutes) && Number.isInteger(session.endMinutes))
    .sort((left, right) => left.date.localeCompare(right.date) || left.startMinutes - right.startMinutes)
}

export function confirmedAssessmentDate(assessment) {
  for (const value of [assessment?.officialDeadline, assessment?.eventDate]) {
    if (!value) continue
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

export function assessmentsForWeek(recordsByEnrolment = {}, modules = [], weekStart) {
  const start = startOfLocalWeek(weekStart)
  const end = addLocalDays(start, 7)
  const moduleByEnrolment = new Map(modules.map(module => [module.enrolmentId, module]))
  const results = []

  for (const [enrolmentId, record] of Object.entries(recordsByEnrolment || {})) {
    const module = moduleByEnrolment.get(enrolmentId)
    for (const assessment of record?.assessments || []) {
      const date = confirmedAssessmentDate(assessment)
      if (!date || date < start || date >= end) continue
      results.push({
        id: assessment.id,
        enrolmentId,
        name: assessment.name,
        type: assessment.type,
        weight: assessment.weight ?? null,
        date: date.toISOString(),
        moduleCode: module?.code || 'Module',
        moduleTitle: module?.title || '',
      })
    }
  }

  return results.sort((left, right) => new Date(left.date) - new Date(right.date) || left.moduleCode.localeCompare(right.moduleCode))
}

export function summarizeStudyWeek(blocks = []) {
  const included = blocks.filter(block => block.status !== 'SKIPPED')
  const completed = blocks.filter(block => block.status === 'COMPLETED')
  const plannedMinutes = included.reduce((sum, block) => sum + blockDurationMinutes(block), 0)
  const completedMinutes = completed.reduce((sum, block) => sum + blockDurationMinutes(block), 0)
  const byModule = new Map()

  for (const block of included) {
    const key = block.enrolmentId || 'GENERAL'
    const current = byModule.get(key) || {
      key,
      code: block.moduleCode || 'GENERAL',
      title: block.moduleTitle || 'General study',
      minutes: 0,
      completedMinutes: 0,
      blockCount: 0,
    }
    current.minutes += blockDurationMinutes(block)
    current.completedMinutes += block.status === 'COMPLETED' ? blockDurationMinutes(block) : 0
    current.blockCount += 1
    byModule.set(key, current)
  }

  return {
    plannedMinutes,
    completedMinutes,
    uncompletedCount: blocks.filter(block => block.status === 'PLANNED').length,
    skippedCount: blocks.filter(block => block.status === 'SKIPPED').length,
    byModule: [...byModule.values()].sort((left, right) => right.minutes - left.minutes || left.code.localeCompare(right.code)),
  }
}

export function focusRouteForBlock(block) {
  const query = {}
  if (block?.enrolmentId) query.module = String(block.enrolmentId).slice(0, 200)
  const goal = text(block?.goal, 240)
  if (goal) query.goal = goal
  return { path: '/app/focus', query }
}
