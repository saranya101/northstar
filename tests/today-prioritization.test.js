import { describe, expect, it } from 'vitest'
import { recommendedTodayAction, summarizeModules, todayActionCandidates } from '../shared/academic/today-prioritization'

const now = new Date('2026-08-10T12:00:00.000Z')

describe('Today deterministic prioritisation', () => {
  it('orders overdue before due today, in-progress, assessments and backlog', () => {
    const candidates = todayActionCandidates({
      tasks: [
        { id: 'backlog', title: 'Read notes', status: 'BACKLOG' },
        { id: 'progress', title: 'Draft report', status: 'IN_PROGRESS' },
        { id: 'today', title: 'Submit tutorial', status: 'PLANNED', dueAt: '2026-08-10T15:00:00.000Z' },
        { id: 'overdue', title: 'Missed task', status: 'PLANNED', dueAt: '2026-08-09T12:00:00.000Z' }
      ],
      assessments: [{ id: 'quiz', name: 'Quiz', moduleCode: 'AB1201', weight: 20, date: '2026-08-17T12:00:00.000Z' }]
    }, now)
    expect(candidates.map(item => item.id)).toEqual(['overdue', 'today', 'progress', 'quiz', 'backlog'])
    expect(recommendedTodayAction({ tasks: candidates.filter(item => item.kind === 'TASK') }, now)?.id).toBe('overdue')
  })

  it('places before-class and submitted-unverified coursework in the defined order', () => {
    const candidates = todayActionCandidates({ coursework: [
      { id: 'verify', requirementId: 'r1', title: 'LAMS 1', status: 'SUBMITTED', verified: false, completeBeforeClass: false },
      { id: 'before', requirementId: 'r2', title: 'Tutorial prep', status: 'NOT_STARTED', verified: false, completeBeforeClass: true }
    ] }, now)
    expect(candidates.map(item => item.id)).toEqual(['before', 'verify'])
  })

  it('uses the academic timezone for due-today boundaries', () => {
    const boundary = new Date('2026-08-09T16:30:00.000Z')
    const result = todayActionCandidates({ tasks: [{ id: 'sg-today', title: 'Morning task', status: 'PLANNED', dueAt: '2026-08-10T00:30:00.000+08:00' }] }, boundary, 'Asia/Singapore')
    expect(result[0].rank).toBe(2)
  })

  it('summarizes module state without fabricated dates', () => {
    const result = summarizeModules([{ enrolmentId: 'e1', code: 'AB1201', title: 'Analytics', academicUnits: 3, sessions: [], tasks: [{ status: 'BACKLOG' }, { status: 'COMPLETED' }], coursework: [{ status: 'MISSED' }], assessments: [{ id: 'a1', date: null, weight: 20, status: 'GRADED' }] }], now)[0]
    expect(result).toMatchObject({ openTaskCount: 1, courseworkAttentionCount: 1, knownGradeWeight: 20, nextClass: null, nextAssessment: null })
  })
})
