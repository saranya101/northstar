export const CALENDAR_EVENT_TYPES = Object.freeze({
  ASSESSMENT_DEADLINE: 'ASSESSMENT_DEADLINE',
  ASSESSMENT_EVENT: 'ASSESSMENT_EVENT',
  EXAM: 'EXAM',
  CLASS_SESSION: 'CLASS_SESSION'
})

export const CALENDAR_EVENT_CATEGORIES = Object.freeze({
  ASSESSMENT: 'ASSESSMENT',
  EXAM: 'EXAM',
  CLASS: 'CLASS'
})

export const CALENDAR_FILTER_TYPES = Object.freeze([
  { value: 'ALL', label: 'All event types' },
  { value: CALENDAR_EVENT_CATEGORIES.ASSESSMENT, label: 'Assessments' },
  { value: CALENDAR_EVENT_CATEGORIES.EXAM, label: 'Examinations' },
  { value: CALENDAR_EVENT_CATEGORIES.CLASS, label: 'Class sessions' }
])

const DEFAULT_TIME_ZONE = 'Asia/Singapore'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
const EXAM_TYPES = new Set(['FINAL_EXAMINATION', 'ORAL_EXAMINATION'])
const DAY_OFFSETS = Object.freeze({
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6
})

const TIMING_PATTERNS = [
  /\b(?:teaching\s+)?week\s*\d+(?:\s*[-–]\s*\d+)?\b/i,
  /\bbefore\s+(?:the\s+)?(?:seminar|tutorial|lecture|class|lesson)\b/i,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:teaching\s+)?week\b/i,
  /\b(?:during|after)\s+(?:the\s+)?(?:seminar|tutorial|lecture|class|lesson)\b/i
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateFromKey(value) {
  const match = DATE_ONLY_PATTERN.exec(String(value || ''))
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) return null
  return date
}

function localDateTimeMatch(value) {
  return LOCAL_DATE_TIME_PATTERN.exec(String(value || ''))
}

function partsInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const result = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return result.year && result.month && result.day ? result : null
}

export function humanizeCalendarValue(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export function dateKey(value, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return null
  const text = String(value)
  const dateOnly = DATE_ONLY_PATTERN.exec(text)
  if (dateOnly && dateFromKey(text)) return text

  const local = localDateTimeMatch(text)
  if (local && dateFromKey(`${local[1]}-${local[2]}-${local[3]}`)) {
    return `${local[1]}-${local[2]}-${local[3]}`
  }

  const parts = partsInTimeZone(value, timeZone)
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null
}

export function dateTimeKey(value, timeZone = DEFAULT_TIME_ZONE) {
  const local = localDateTimeMatch(String(value || ''))
  if (local) return `${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}:${local[6] || '00'}`
  const parts = partsInTimeZone(value, timeZone)
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` : null
}

export function isAllDayValue(value) {
  return DATE_ONLY_PATTERN.test(String(value || ''))
}

export function addDays(dateValue, amount) {
  const date = dateFromKey(dateValue)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + Number(amount || 0))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function addMinutes(value, amount) {
  const text = String(value || '')
  const local = localDateTimeMatch(text)
  if (local) {
    const date = new Date(Date.UTC(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] || 0)
    ))
    date.setUTCMinutes(date.getUTCMinutes() + Number(amount || 0))
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setUTCMinutes(date.getUTCMinutes() + Number(amount || 0))
  return date.toISOString()
}

export function startOfWeekMonday(dateValue) {
  const date = dateFromKey(dateValue)
  if (!date) return null
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function firstDayOfMonth(value, timeZone = DEFAULT_TIME_ZONE) {
  const key = dateKey(value, timeZone)
  return key ? `${key.slice(0, 7)}-01` : null
}

export function shiftMonth(monthStart, amount) {
  const date = dateFromKey(monthStart)
  if (!date) return null
  date.setUTCMonth(date.getUTCMonth() + Number(amount || 0), 1)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`
}

export function lastDayOfMonth(monthStart) {
  const next = shiftMonth(monthStart, 1)
  return next ? addDays(next, -1) : null
}

export function extractTimingReference(assessment) {
  const candidates = [
    assessment?.instructions,
    assessment?.examFormat,
    ...(assessment?.provenance || []).flatMap(item => [item?.sourceExcerpt, item?.sectionHeading])
  ].filter(Boolean)

  for (const value of candidates) {
    for (const pattern of TIMING_PATTERNS) {
      const match = String(value).match(pattern)
      if (match) return match[0]
    }
  }
  return null
}

function moduleSnapshot(module) {
  return {
    moduleId: module?.enrolmentId || module?.userModuleEnrolmentId || module?.id || null,
    moduleCode: module?.code || module?.module?.code || 'Module',
    moduleTitle: module?.title || module?.module?.title || ''
  }
}

function assessmentSource(assessment) {
  const provenance = assessment?.provenance || []
  if (provenance.length) {
    const source = provenance[0]
    return {
      sourceStatus: 'CONFIRMED_SOURCE',
      sourceLabel: source.sourceLabel ? `Confirmed from ${source.sourceLabel}` : 'Confirmed imported source'
    }
  }
  return {
    sourceStatus: 'MANUAL',
    sourceLabel: 'Manually confirmed'
  }
}

function assessmentDescription(assessment, kind) {
  const parts = []
  if (kind === CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE) parts.push('Confirmed official assessment deadline.')
  else if (kind === CALENDAR_EVENT_TYPES.EXAM) parts.push('Confirmed examination date.')
  else parts.push('Confirmed assessment event date.')
  if (assessment.weight !== null && assessment.weight !== undefined) parts.push(`Weight: ${assessment.weight}%.`)
  if (assessment.submissionPlatform) parts.push(`Platform: ${assessment.submissionPlatform}.`)
  if (assessment.examFormat) parts.push(`Format: ${assessment.examFormat}.`)
  return parts.join(' ')
}

function assessmentLocation(assessment, kind) {
  if (kind === CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE) {
    if (assessment.submissionPlatform) return assessment.submissionPlatform
    if (assessment.submissionUrl) return 'Online submission'
    return null
  }
  if (/\bonline\b|\bzoom\b|\bteams\b/i.test(String(assessment.examFormat || ''))) return 'Online'
  return null
}

function createAssessmentEvent({ assessment, module, kind, start, timeZone }) {
  const snapshot = moduleSnapshot(module)
  const allDay = isAllDayValue(start)
  const exam = kind === CALENDAR_EVENT_TYPES.EXAM
  const source = assessmentSource(assessment)
  const suffix = kind === CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE ? 'deadline' : exam ? 'exam' : 'event'
  const eventDateKey = dateKey(start, timeZone)

  return {
    id: `assessment:${assessment.id}:${suffix}`,
    sourceId: assessment.id,
    type: kind,
    category: exam ? CALENDAR_EVENT_CATEGORIES.EXAM : CALENDAR_EVENT_CATEGORIES.ASSESSMENT,
    title: assessment.name,
    subtitle: kind === CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE
      ? 'Official deadline'
      : exam
        ? humanizeCalendarValue(assessment.type)
        : 'Assessment event',
    ...snapshot,
    start,
    end: allDay ? addDays(eventDateKey, 1) : assessment.eventEndDate || addMinutes(start, exam ? 120 : 30),
    dateKey: eventDateKey,
    allDay,
    timeZone,
    weight: assessment.weight ?? null,
    location: assessmentLocation(assessment, kind),
    online: Boolean(
      assessment.submissionUrl
      || assessment.submissionPlatform
      || /\bonline\b|\bzoom\b|\bteams\b/i.test(String(assessment.examFormat || ''))
    ),
    sourceStatus: source.sourceStatus,
    sourceLabel: source.sourceLabel,
    description: assessmentDescription(assessment, kind),
    link: `/app/assessments/${assessment.id}`,
    enrolmentLink: snapshot.moduleId ? `/app/modules/${snapshot.moduleId}#assessments` : null
  }
}

export function buildAssessmentEvents({
  modules = [],
  assessmentRecords = {},
  timeZone = DEFAULT_TIME_ZONE
} = {}) {
  const events = []
  const unresolved = []

  for (const module of modules) {
    const snapshot = moduleSnapshot(module)
    const record = assessmentRecords?.[snapshot.moduleId]
    const assessments = Array.isArray(record) ? record : record?.assessments || []

    for (const assessment of assessments) {
      if (!assessment || assessment.status === 'CANCELLED') continue

      if (assessment.officialDeadline) {
        events.push(createAssessmentEvent({
          assessment,
          module,
          kind: CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE,
          start: assessment.officialDeadline,
          timeZone
        }))
      }

      if (assessment.eventDate) {
        events.push(createAssessmentEvent({
          assessment,
          module,
          kind: EXAM_TYPES.has(assessment.type)
            ? CALENDAR_EVENT_TYPES.EXAM
            : CALENDAR_EVENT_TYPES.ASSESSMENT_EVENT,
          start: assessment.eventDate,
          timeZone
        }))
      }

      const needsExamDate = EXAM_TYPES.has(assessment.type) && !assessment.eventDate
      const hasNoPersistedDate = !assessment.officialDeadline && !assessment.eventDate
      if (needsExamDate || hasNoPersistedDate) {
        const source = assessmentSource(assessment)
        unresolved.push({
          id: `unresolved:${assessment.id}:${needsExamDate ? 'exam' : 'date'}`,
          assessmentId: assessment.id,
          ...snapshot,
          name: assessment.name,
          assessmentType: assessment.type,
          category: needsExamDate ? CALENDAR_EVENT_CATEGORIES.EXAM : CALENDAR_EVENT_CATEGORIES.ASSESSMENT,
          timingReference: extractTimingReference(assessment),
          reason: needsExamDate ? 'Exam date not recorded' : 'No official date recorded',
          weight: assessment.weight ?? null,
          sourceStatus: source.sourceStatus,
          sourceLabel: source.sourceLabel,
          link: `/app/assessments/${assessment.id}`
        })
      }
    }
  }

  return { events: sortCalendarEvents(events), unresolved }
}

function recurrenceAllowsWeek(session, weekNumber) {
  if (session.recurrence === 'ODD_WEEKS') return weekNumber % 2 === 1
  if (session.recurrence === 'EVEN_WEEKS') return weekNumber % 2 === 0
  if (session.recurrence === 'CUSTOM') return (session.weekNumbers || []).includes(weekNumber)
  return true
}

function minutesDateTime(dateValue, minutes) {
  const safeMinutes = Math.max(0, Math.min(1440, Number(minutes || 0)))
  if (safeMinutes === 1440) return `${addDays(dateValue, 1)}T00:00:00`
  return `${dateValue}T${pad(Math.floor(safeMinutes / 60))}:${pad(safeMinutes % 60)}:00`
}

function timetableDescription(session) {
  const parts = [
    `${humanizeCalendarValue(session.classType)} · ${session.groupLabel || 'Default group'}.`,
    `Recurrence: ${humanizeCalendarValue(session.recurrence || 'WEEKLY')}.`,
    `Delivery: ${humanizeCalendarValue(session.deliveryMode || 'UNKNOWN')}.`
  ]
  return parts.join(' ')
}

export function buildTimetableEvents({
  sessions = [],
  activeSemester = null,
  rangeStart = null,
  rangeEnd = null,
  timeZone = DEFAULT_TIME_ZONE
} = {}) {
  const teachingStart = dateKey(activeSemester?.teachingStartDate, timeZone)
  const teachingEnd = dateKey(activeSemester?.teachingEndDate, timeZone)
  if (!teachingStart || !teachingEnd || teachingEnd < teachingStart) return []

  const weekOneMonday = startOfWeekMonday(teachingStart)
  const effectiveStart = rangeStart && rangeStart > teachingStart ? rangeStart : teachingStart
  const effectiveEnd = rangeEnd && rangeEnd < teachingEnd ? rangeEnd : teachingEnd
  if (effectiveEnd < effectiveStart) return []

  const startDate = dateFromKey(weekOneMonday)
  const endDate = dateFromKey(teachingEnd)
  const maximumWeek = Math.floor((endDate.getTime() - startDate.getTime()) / 604800000) + 1
  const events = []

  for (const session of sessions) {
    const dayOffset = DAY_OFFSETS[session.dayOfWeek]
    if (dayOffset === undefined) continue

    for (let weekNumber = 1; weekNumber <= maximumWeek; weekNumber += 1) {
      if (!recurrenceAllowsWeek(session, weekNumber)) continue
      const sessionDate = addDays(weekOneMonday, (weekNumber - 1) * 7 + dayOffset)
      if (!sessionDate || sessionDate < teachingStart || sessionDate > teachingEnd) continue
      if (sessionDate < effectiveStart || sessionDate > effectiveEnd) continue

      const start = minutesDateTime(sessionDate, session.startMinutes)
      const end = minutesDateTime(sessionDate, session.endMinutes)
      const module = session.module || {}
      const moduleId = session.enrolmentId || session.userModuleEnrolmentId || null
      const online = ['ONLINE', 'HYBRID'].includes(session.deliveryMode)
      events.push({
        id: `class:${session.id}:${sessionDate}`,
        sourceId: session.id,
        type: CALENDAR_EVENT_TYPES.CLASS_SESSION,
        category: CALENDAR_EVENT_CATEGORIES.CLASS,
        title: `${module.code || 'Module'} ${humanizeCalendarValue(session.classType)}`,
        subtitle: session.groupLabel || 'Default group',
        moduleId,
        moduleCode: module.code || 'Module',
        moduleTitle: module.title || '',
        start,
        end,
        startMinutes: session.startMinutes,
        endMinutes: session.endMinutes,
        classType: session.classType,
        groupLabel: session.groupLabel,
        dateKey: sessionDate,
        allDay: false,
        timeZone,
        weight: null,
        location: session.venue || (session.deliveryMode === 'ONLINE' ? 'Online' : null),
        online,
        sourceStatus: session.source || 'UNKNOWN',
        sourceLabel: `${humanizeCalendarValue(session.source || 'UNKNOWN')} timetable session`,
        description: timetableDescription(session),
        link: moduleId ? `/app/modules/${moduleId}#timetable` : '/app/timetable',
        enrolmentLink: moduleId ? `/app/modules/${moduleId}` : null,
        recurrence: session.recurrence,
        weekNumber
      })
    }
  }

  return sortCalendarEvents(events)
}

export function sortCalendarEvents(events = []) {
  return [...events].sort((left, right) => (
    String(left.start || '').localeCompare(String(right.start || ''))
    || String(left.end || '').localeCompare(String(right.end || ''))
    || String(left.moduleCode || '').localeCompare(String(right.moduleCode || ''))
    || String(left.title || '').localeCompare(String(right.title || ''))
    || String(left.id || '').localeCompare(String(right.id || ''))
  ))
}

export function filterCalendarEvents(events = [], {
  moduleId = 'ALL',
  eventType = 'ALL',
  startDate = null,
  endDate = null
} = {}) {
  return sortCalendarEvents(events.filter(event => {
    if (moduleId !== 'ALL' && event.moduleId !== moduleId) return false
    if (eventType !== 'ALL' && event.category !== eventType && event.type !== eventType) return false
    const key = event.dateKey || dateKey(event.start, event.timeZone || DEFAULT_TIME_ZONE)
    if (startDate && key < startDate) return false
    if (endDate && key > endDate) return false
    return true
  }))
}

export function groupCalendarEventsByDate(events = []) {
  const groups = []
  for (const event of sortCalendarEvents(events)) {
    const key = event.dateKey || dateKey(event.start, event.timeZone || DEFAULT_TIME_ZONE)
    let group = groups.at(-1)
    if (!group || group.dateKey !== key) {
      group = { dateKey: key, events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

export function buildMonthGrid(monthStart, events = [], today = dateKey(new Date())) {
  const first = firstDayOfMonth(monthStart)
  if (!first) return []
  const gridStart = startOfWeekMonday(first)
  const monthPrefix = first.slice(0, 7)
  const byDate = new Map()

  for (const event of events) {
    const key = event.dateKey || dateKey(event.start, event.timeZone || DEFAULT_TIME_ZONE)
    if (!key) continue
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(event)
  }

  return Array.from({ length: 42 }, (_, index) => {
    const key = addDays(gridStart, index)
    return {
      dateKey: key,
      dayNumber: Number(key.slice(-2)),
      currentMonth: key.startsWith(monthPrefix),
      today: key === today,
      events: sortCalendarEvents(byDate.get(key) || [])
    }
  })
}

export function moduleOptionsFromCalendarData(modules = [], timetableSessions = []) {
  const values = new Map()

  for (const module of modules) {
    const snapshot = moduleSnapshot(module)
    if (!snapshot.moduleId) continue
    values.set(snapshot.moduleId, snapshot)
  }

  for (const session of timetableSessions) {
    const snapshot = moduleSnapshot({
      enrolmentId: session.enrolmentId,
      module: session.module
    })
    if (!snapshot.moduleId || values.has(snapshot.moduleId)) continue
    values.set(snapshot.moduleId, snapshot)
  }

  return [...values.values()].sort((left, right) => (
    left.moduleCode.localeCompare(right.moduleCode)
    || left.moduleTitle.localeCompare(right.moduleTitle)
  ))
}

export function buildCalendarData({
  modules = [],
  assessmentRecords = {},
  timetable = null,
  timeZone = DEFAULT_TIME_ZONE
} = {}) {
  const assessmentData = buildAssessmentEvents({ modules, assessmentRecords, timeZone })
  const timetableEvents = buildTimetableEvents({
    sessions: timetable?.sessions || [],
    activeSemester: timetable?.activeSemester || null,
    timeZone
  })

  return {
    events: sortCalendarEvents([...assessmentData.events, ...timetableEvents]),
    unresolved: assessmentData.unresolved,
    modules: moduleOptionsFromCalendarData(modules, timetable?.sessions || []),
    activeSemester: timetable?.activeSemester || null,
    timetableSessionCount: timetable?.sessions?.length || 0,
    timetableMapped: Boolean(
      dateKey(timetable?.activeSemester?.teachingStartDate, timeZone)
      && dateKey(timetable?.activeSemester?.teachingEndDate, timeZone)
    )
  }
}
