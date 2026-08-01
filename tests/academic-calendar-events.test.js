import { describe, expect, it } from 'vitest'
import {
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_EVENT_TYPES,
  buildAssessmentEvents,
  buildCalendarData,
  buildMonthGrid,
  buildTimetableEvents,
  filterCalendarEvents,
  groupCalendarEventsByDate
} from '../shared/calendar/events.js'

const modules = [
  { enrolmentId: 'enrolment-ab1201', code: 'AB1201', title: 'Financial Management' },
  { enrolmentId: 'enrolment-cc0001', code: 'CC0001', title: 'Inquiry and Communication' }
]

describe('academic calendar assessment dates', () => {
  it('turns only persisted confirmed dates into calendar events', () => {
    const result = buildAssessmentEvents({
      modules,
      assessmentRecords: {
        'enrolment-ab1201': {
          assessments: [{
            id: 'assessment-1',
            name: 'Case report',
            type: 'REPORT',
            status: 'IN_PROGRESS',
            weight: 30,
            officialDeadline: '2026-09-08T15:59:00.000Z',
            eventDate: '2026-09-01T04:00:00.000Z',
            provenance: []
          }]
        }
      }
    })

    expect(result.events).toHaveLength(2)
    expect(result.events.map(event => event.type)).toEqual([
      CALENDAR_EVENT_TYPES.ASSESSMENT_EVENT,
      CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE
    ])
    expect(result.events.every(event => event.moduleCode === 'AB1201')).toBe(true)
    expect(result.events.find(event => event.type === CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE)).toMatchObject({
      weight: 30,
      link: '/app/assessments/assessment-1',
      sourceLabel: 'Manually confirmed'
    })
  })

  it('does not turn teaching-week prose into a dated event', () => {
    const result = buildAssessmentEvents({
      modules,
      assessmentRecords: {
        'enrolment-ab1201': {
          assessments: [{
            id: 'assessment-week',
            name: 'Mid-semester quiz',
            type: 'QUIZ',
            status: 'NOT_STARTED',
            officialDeadline: null,
            eventDate: null,
            instructions: 'Quiz takes place in Week 8 before seminar.',
            provenance: []
          }]
        }
      }
    })

    expect(result.events).toEqual([])
    expect(result.unresolved).toEqual([
      expect.objectContaining({
        assessmentId: 'assessment-week',
        timingReference: 'Week 8',
        reason: 'No official date recorded'
      })
    ])
  })

  it('keeps an exam awaiting its official event date even when another deadline exists', () => {
    const result = buildAssessmentEvents({
      modules,
      assessmentRecords: {
        'enrolment-ab1201': {
          assessments: [{
            id: 'exam-1',
            name: 'Final examination',
            type: 'FINAL_EXAMINATION',
            status: 'NOT_STARTED',
            officialDeadline: '2026-11-10T04:00:00.000Z',
            eventDate: null,
            provenance: []
          }]
        }
      }
    })

    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe(CALENDAR_EVENT_TYPES.ASSESSMENT_DEADLINE)
    expect(result.unresolved[0]).toMatchObject({
      assessmentId: 'exam-1',
      category: CALENDAR_EVENT_CATEGORIES.EXAM,
      reason: 'Exam date not recorded'
    })
  })

  it('creates confirmed examinations from persisted eventDate values', () => {
    const result = buildAssessmentEvents({
      modules,
      assessmentRecords: {
        'enrolment-cc0001': {
          assessments: [{
            id: 'exam-2',
            name: 'Oral examination',
            type: 'ORAL_EXAMINATION',
            status: 'NOT_STARTED',
            weight: 20,
            eventDate: '2026-10-15T02:00:00.000Z',
            officialDeadline: null,
            examFormat: 'In person',
            provenance: [{ sourceLabel: 'Course outline' }]
          }]
        }
      }
    })

    expect(result.events).toEqual([
      expect.objectContaining({
        type: CALENDAR_EVENT_TYPES.EXAM,
        category: CALENDAR_EVENT_CATEGORIES.EXAM,
        moduleCode: 'CC0001',
        sourceStatus: 'CONFIRMED_SOURCE'
      })
    ])
    expect(result.unresolved).toEqual([])
  })
})

describe('academic calendar timetable expansion', () => {
  const timetable = {
    activeSemester: {
      teachingStartDate: '2026-08-10T00:00:00.000Z',
      teachingEndDate: '2026-08-30T00:00:00.000Z'
    },
    sessions: [{
      id: 'session-1',
      enrolmentId: 'enrolment-ab1201',
      classType: 'SEMINAR',
      groupLabel: 'S1',
      dayOfWeek: 'TUESDAY',
      startMinutes: 600,
      endMinutes: 720,
      venue: 'S3-SR1',
      deliveryMode: 'IN_PERSON',
      recurrence: 'ODD_WEEKS',
      weekNumbers: [],
      source: 'IMPORTED',
      module: { code: 'AB1201', title: 'Financial Management' }
    }]
  }

  it('maps recurring sessions only through the persisted semester date range', () => {
    const events = buildTimetableEvents({
      sessions: timetable.sessions,
      activeSemester: timetable.activeSemester
    })

    expect(events.map(event => event.dateKey)).toEqual(['2026-08-11', '2026-08-25'])
    expect(events[0]).toMatchObject({
      start: '2026-08-11T10:00:00',
      end: '2026-08-11T12:00:00',
      category: CALENDAR_EVENT_CATEGORIES.CLASS,
      location: 'S3-SR1'
    })
  })

  it('supports timetable export date-range filtering without creating extra dates', () => {
    const events = buildTimetableEvents({
      sessions: timetable.sessions,
      activeSemester: timetable.activeSemester,
      rangeStart: '2026-08-20',
      rangeEnd: '2026-08-30'
    })

    expect(events).toHaveLength(1)
    expect(events[0].dateKey).toBe('2026-08-25')
  })

  it('does not create timetable dates without an official semester mapping', () => {
    expect(buildTimetableEvents({
      sessions: timetable.sessions,
      activeSemester: { teachingStartDate: null, teachingEndDate: null }
    })).toEqual([])
  })
})

describe('calendar ordering, filters and month structures', () => {
  const events = [
    { id: 'b', start: '2026-09-03T09:00:00', end: '2026-09-03T10:00:00', dateKey: '2026-09-03', moduleId: 'm2', moduleCode: 'CC0001', title: 'Class', category: 'CLASS', type: 'CLASS_SESSION' },
    { id: 'a', start: '2026-09-01T09:00:00', end: '2026-09-01T10:00:00', dateKey: '2026-09-01', moduleId: 'm1', moduleCode: 'AB1201', title: 'Quiz', category: 'ASSESSMENT', type: 'ASSESSMENT_EVENT' },
    { id: 'c', start: '2026-09-02T09:00:00', end: '2026-09-02T10:00:00', dateKey: '2026-09-02', moduleId: 'm1', moduleCode: 'AB1201', title: 'Exam', category: 'EXAM', type: 'EXAM' }
  ]

  it('orders events chronologically and groups them by local date', () => {
    const groups = groupCalendarEventsByDate(events)
    expect(groups.map(group => group.dateKey)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('filters by module and event category', () => {
    expect(filterCalendarEvents(events, { moduleId: 'm1' }).map(event => event.id)).toEqual(['a', 'c'])
    expect(filterCalendarEvents(events, { eventType: 'EXAM' }).map(event => event.id)).toEqual(['c'])
  })

  it('builds a six-week month grid and preserves empty days', () => {
    const grid = buildMonthGrid('2026-09-01', events, '2026-09-02')
    expect(grid).toHaveLength(42)
    expect(grid.find(day => day.dateKey === '2026-09-02')).toMatchObject({
      today: true,
      events: [expect.objectContaining({ id: 'c' })]
    })
  })

  it('supports assessments-only, exams-only, timetable-only and empty calendar data', () => {
    const empty = buildCalendarData()
    expect(empty.events).toEqual([])
    expect(empty.unresolved).toEqual([])

    const classesOnly = buildCalendarData({
      timetable: {
        activeSemester: {
          teachingStartDate: '2026-08-10',
          teachingEndDate: '2026-08-16'
        },
        sessions: [{
          id: 'class-only',
          enrolmentId: 'enrolment-ab1201',
          classType: 'LECTURE',
          groupLabel: 'LE',
          dayOfWeek: 'MONDAY',
          startMinutes: 480,
          endMinutes: 540,
          recurrence: 'WEEKLY',
          weekNumbers: [],
          source: 'MANUAL',
          deliveryMode: 'ONLINE',
          module: { code: 'AB1201', title: 'Financial Management' }
        }]
      }
    })
    expect(classesOnly.events).toEqual([
      expect.objectContaining({ category: CALENDAR_EVENT_CATEGORIES.CLASS, location: 'Online' })
    ])
  })
})
