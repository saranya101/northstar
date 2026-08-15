import { describe, expect, it } from 'vitest'
import {
  assessmentsForWeek,
  classOccurrencesForWeek,
  createStudyBlock,
  focusRouteForBlock,
  intervalsOverlap,
  startOfLocalWeek,
  studyBlockConflicts,
  summarizeStudyWeek,
} from '../shared/planner/weekly-planner.js'

const week = startOfLocalWeek(new Date(2026, 7, 10, 12))
const base = { userId: 'user-1', date: '2026-08-10', startMinutes: 600, endMinutes: 660, status: 'PLANNED' }
function block(id, patch = {}) { return createStudyBlock({ title: id, ...base, ...patch }, { userId: 'user-1', id, now: new Date('2026-08-01T00:00:00Z') }).block }

describe('weekly planner calculations', () => {
  it('detects overlapping study blocks but allows adjacent blocks', () => {
    expect(intervalsOverlap(block('a'), block('b', { startMinutes: 630, endMinutes: 690 }))).toBe(true)
    expect(intervalsOverlap(block('a'), block('c', { startMinutes: 660, endMinutes: 720 }))).toBe(false)
  })

  it('detects conflicts with fixed timetable sessions', () => {
    const candidate = block('candidate')
    const classes = [{ id: 'class-1', date: '2026-08-10', startMinutes: 630, endMinutes: 720, classType: 'SEMINAR', module: { code: 'AB1201' } }]
    expect(studyBlockConflicts(candidate, [], classes)).toMatchObject([{ kind: 'CLASS_SESSION', id: 'class-1' }])
  })

  it('maps recurring class sessions into the selected local week', () => {
    const timetable = { activeSemester: { teachingStartDate: '2026-08-10T00:00:00.000Z', teachingEndDate: '2026-11-30T00:00:00.000Z' }, sessions: [{ id: 's1', dayOfWeek: 'TUESDAY', startMinutes: 540, endMinutes: 660, recurrence: 'WEEKLY', weekNumbers: [], module: { code: 'AB0403' } }] }
    expect(classOccurrencesForWeek(timetable, week)).toMatchObject([{ id: 's1', date: '2026-08-11', fixed: true }])
  })

  it('uses the canonical recess-aware teaching week for planner occurrences', () => {
    const activeSemester = {
      teachingStartDate: '2026-08-10', teachingEndDate: '2026-11-30',
      recessStartDate: '2026-09-28', recessEndDate: '2026-10-04'
    }
    const session = { id: 'week-8', dayOfWeek: 'TUESDAY', startMinutes: 540, endMinutes: 660, recurrence: 'CUSTOM', weekNumbers: [8] }
    expect(classOccurrencesForWeek({ activeSemester, sessions: [session] }, startOfLocalWeek(new Date(2026, 8, 28, 12)))).toEqual([])
    expect(classOccurrencesForWeek({ activeSemester, sessions: [session] }, startOfLocalWeek(new Date(2026, 9, 5, 12)))).toMatchObject([{ id: 'week-8', date: '2026-10-06' }])
  })

  it('calculates planned, completed and module totals without counting skipped time', () => {
    const result = summarizeStudyWeek([
      block('planned', { enrolmentId: 'e1', moduleCode: 'AB1201' }),
      block('completed', { enrolmentId: 'e1', moduleCode: 'AB1201', status: 'COMPLETED', startMinutes: 660, endMinutes: 780 }),
      block('general', { date: '2026-08-11', startMinutes: 600, endMinutes: 630 }),
      block('skipped', { status: 'SKIPPED', startMinutes: 780, endMinutes: 840 }),
    ])
    expect(result).toMatchObject({ plannedMinutes: 210, completedMinutes: 120, uncompletedCount: 2, skippedCount: 1 })
    expect(result.byModule.find(item => item.code === 'AB1201')).toMatchObject({ minutes: 180, completedMinutes: 120 })
    expect(result.byModule.find(item => item.code === 'GENERAL')).toMatchObject({ minutes: 30 })
  })

  it('keeps general-study blocks valid without a module', () => {
    expect(block('general')).toMatchObject({ enrolmentId: null, moduleCode: null, title: 'general' })
  })

  it('includes only persisted official or event dates and never teaching-week text', () => {
    const records = { e1: { assessments: [
      { id: 'dated', name: 'Quiz', officialDeadline: '2026-08-12T11:00:00.000Z', eventDate: null },
      { id: 'week-only', name: 'Week 8 quiz', officialDeadline: null, eventDate: null, instructions: 'Tuesday of Week 8' },
      { id: 'later', name: 'Final', eventDate: '2026-09-01T01:00:00.000Z' },
    ] } }
    expect(assessmentsForWeek(records, [{ enrolmentId: 'e1', code: 'AB1201' }], week).map(item => item.id)).toEqual(['dated'])
  })

  it('builds a safe Focus route with module and goal query values', () => {
    expect(focusRouteForBlock(block('focus', { enrolmentId: 'e1', goal: 'Finish Q1 & Q2' }))).toEqual({ path: '/app/focus', query: { module: 'e1', goal: 'Finish Q1 & Q2' } })
  })
})
