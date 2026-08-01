import { describe, expect, it } from 'vitest'
import {
  createIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  safeIcsFileName,
  stableCalendarUid
} from '../shared/calendar/ics.js'

const assessmentEvent = {
  id: 'assessment:assessment-1:deadline',
  type: 'ASSESSMENT_DEADLINE',
  category: 'ASSESSMENT',
  moduleCode: 'AB1201',
  moduleTitle: 'Financial Management',
  title: 'Case report, part 1',
  start: '2026-09-08T15:59:00.000Z',
  end: '2026-09-08T16:29:00.000Z',
  dateKey: '2026-09-08',
  timeZone: 'Asia/Singapore',
  allDay: false,
  weight: 30,
  location: 'NTULearn; Online',
  sourceLabel: 'Confirmed from Course outline',
  description: 'Submit the report\\appendix.\nBring evidence.',
  link: '/app/assessments/assessment-1'
}

describe('ICS text and identity', () => {
  it('escapes commas, semicolons, backslashes and line breaks', () => {
    expect(escapeIcsText('A,B;C\\D\nE')).toBe('A\\,B\\;C\\\\D\\nE')
  })

  it('creates stable UIDs from stable event IDs', () => {
    expect(stableCalendarUid(assessmentEvent)).toBe(stableCalendarUid({ ...assessmentEvent, title: 'Renamed' }))
    expect(stableCalendarUid(assessmentEvent)).not.toBe(stableCalendarUid({ ...assessmentEvent, id: 'another' }))
    expect(stableCalendarUid(assessmentEvent)).toMatch(/@northstar\.local$/)
  })

  it('folds long content lines using calendar continuation syntax', () => {
    const line = `DESCRIPTION:${'A'.repeat(120)}`
    const folded = foldIcsLine(line)
    expect(folded).toContain('\r\n ')
    expect(folded.split('\r\n').every(part => new TextEncoder().encode(part).length <= 75)).toBe(true)
  })
})

describe('ICS calendar generation', () => {
  it('exports timed values with the Singapore timezone and required fields', () => {
    const output = createIcsCalendar([assessmentEvent], {
      now: new Date('2026-08-01T07:00:00.000Z')
    })

    expect(output).toContain('BEGIN:VCALENDAR\r\n')
    expect(output).toContain('BEGIN:VTIMEZONE\r\nTZID:Asia/Singapore')
    expect(output).toContain('DTSTART;TZID=Asia/Singapore:20260908T235900')
    expect(output).toContain('DTEND;TZID=Asia/Singapore:20260909T002900')
    expect(output).toContain('SUMMARY:AB1201 · Case report\\, part 1')
    expect(output).toContain('LOCATION:NTULearn\\; Online')
    expect(output).toContain('UID:')
    expect(output).toContain('END:VCALENDAR\r\n')
  })

  it('exports all-day events with an exclusive next-day DTEND', () => {
    const output = createIcsCalendar([{
      id: 'exam-all-day',
      type: 'EXAM',
      category: 'EXAM',
      moduleCode: 'CC0001',
      title: 'Final examination',
      start: '2026-11-20',
      end: '2026-11-21',
      dateKey: '2026-11-20',
      allDay: true,
      sourceLabel: 'Confirmed source'
    }], { now: new Date('2026-08-01T07:00:00.000Z') })

    expect(output).toContain('DTSTART;VALUE=DATE:20261120')
    expect(output).toContain('DTEND;VALUE=DATE:20261121')
    expect(output).not.toContain('DTSTART;TZID=Asia/Singapore:20261120')
  })

  it('exports confirmed exams and timetable occurrences without unresolved records', () => {
    const events = [
      {
        id: 'exam-1',
        type: 'EXAM',
        category: 'EXAM',
        moduleCode: 'AB1201',
        title: 'Final examination',
        start: '2026-11-24T09:00:00',
        end: '2026-11-24T11:00:00',
        dateKey: '2026-11-24',
        timeZone: 'Asia/Singapore',
        allDay: false,
        sourceLabel: 'Confirmed from course outline'
      },
      {
        id: 'class:session-1:2026-08-11',
        type: 'CLASS_SESSION',
        category: 'CLASS',
        moduleCode: 'AB1201',
        title: 'AB1201 Seminar',
        start: '2026-08-11T10:00:00',
        end: '2026-08-11T12:00:00',
        dateKey: '2026-08-11',
        timeZone: 'Asia/Singapore',
        allDay: false,
        location: 'S3-SR1',
        sourceLabel: 'Imported timetable session'
      }
    ]

    const output = createIcsCalendar(events, { now: new Date('2026-08-01T07:00:00.000Z') })
    expect(output.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(output).toContain('CATEGORIES:EXAM')
    expect(output).toContain('CATEGORIES:CLASS')
    expect(output).not.toContain('Week 8')
  })

  it('creates safe .ics filenames', () => {
    expect(safeIcsFileName('Northstar: AB1201 / Exams')).toBe('northstar-ab1201-exams.ics')
  })
})
