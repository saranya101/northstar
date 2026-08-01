import { describe, expect, it } from 'vitest'
import {
  HISTORY_RANGES,
  filterFocusSessions,
  groupFocusSessionsByModule,
  startOfCurrentLocalWeek,
  summarizeFocusSessions,
} from '../shared/focus/history.js'

function record({
  id,
  endedAt,
  seconds,
  moduleEnrolmentId = null,
  moduleCode = 'GENERAL',
  moduleTitle = 'General study',
  completionState = 'COMPLETED',
}) {
  return {
    id,
    userId: 'user-1',
    moduleEnrolmentId,
    moduleCode,
    moduleTitle,
    endedAt,
    startedAt: endedAt,
    createdAt: endedAt,
    actualFocusedSeconds: seconds,
    plannedFocusedSeconds: seconds,
    completionState,
    pauseCount: 0,
  }
}

describe('focus history summaries and filters', () => {
  const now = new Date('2026-08-05T12:00:00+08:00')
  const sessions = [
    record({ id: 'today-ab', endedAt: '2026-08-05T02:00:00.000Z', seconds: 1500, moduleEnrolmentId: 'e1', moduleCode: 'AB1201', moduleTitle: 'Financial Management' }),
    record({ id: 'today-general', endedAt: '2026-08-05T04:00:00.000Z', seconds: 600, completionState: 'FINISHED_EARLY' }),
    record({ id: 'week-ab', endedAt: '2026-08-03T04:00:00.000Z', seconds: 3000, moduleEnrolmentId: 'e1', moduleCode: 'AB1201', moduleTitle: 'Financial Management' }),
    record({ id: 'old', endedAt: '2026-07-29T04:00:00.000Z', seconds: 900, moduleEnrolmentId: 'e2', moduleCode: 'CC0001', moduleTitle: 'Inquiry and Communication' }),
  ]

  it('uses local calendar-day and current-week boundaries', () => {
    expect(startOfCurrentLocalWeek(now, 1).getDay()).toBe(1)
    const summary = summarizeFocusSessions(sessions, now, 1)
    expect(summary.todayFocusedSeconds).toBe(2100)
    expect(summary.weekFocusedSeconds).toBe(5100)
    expect(summary.completedSessionsToday).toBe(2)
  })

  it('filters today and this week', () => {
    expect(filterFocusSessions(sessions, { range: HISTORY_RANGES.TODAY, now })).toHaveLength(2)
    expect(filterFocusSessions(sessions, { range: HISTORY_RANGES.WEEK, now })).toHaveLength(3)
  })

  it('filters one module without exposing other modules', () => {
    const filtered = filterFocusSessions(sessions, {
      moduleKey: 'enrolment:e1',
      range: HISTORY_RANGES.ALL,
      now,
    })
    expect(filtered.map(item => item.id)).toEqual(['today-ab', 'week-ab'])
  })

  it('groups focused time by module including general study', () => {
    const groups = groupFocusSessionsByModule(sessions)
    expect(groups.find(group => group.key === 'enrolment:e1')).toMatchObject({
      focusedSeconds: 4500,
      sessionCount: 2,
    })
    expect(groups.find(group => group.key === 'general')).toMatchObject({
      label: 'General study',
      focusedSeconds: 600,
    })
  })
})
