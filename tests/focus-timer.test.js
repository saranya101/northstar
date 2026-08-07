import { describe, expect, it } from 'vitest'
import {
  SESSION_COMPLETION_STATES,
  TIMER_MODES,
  TIMER_STATUSES,
  createBreakTimerFromFocus,
  createStudySessionRecord,
  createTimerState,
  pauseTimer,
  resumeTimer,
  startReadyTimer,
  timerSnapshot,
  validateCustomDurations,
} from '../shared/focus/timer.js'

const START = new Date('2026-08-01T02:00:00.000Z').getTime()

function focusTimer(overrides = {}) {
  return createTimerState({
    sessionId: 'session-1',
    userId: 'user-1',
    mode: TIMER_MODES.FOCUS,
    now: START,
    plannedDurationSeconds: 25 * 60,
    focusDurationSeconds: 25 * 60,
    breakDurationSeconds: 5 * 60,
    module: { enrolmentId: 'enrolment-1', code: 'AB1201', title: 'Financial Management' },
    goal: 'Finish tutorial questions',
    ...overrides,
  })
}

describe('focus timer calculations', () => {
  it('starts a focus session from timestamps', () => {
    const timer = focusTimer()
    expect(timer.status).toBe(TIMER_STATUSES.RUNNING)
    expect(timer.startedAt).toBe('2026-08-01T02:00:00.000Z')
    expect(timerSnapshot(timer, START)).toMatchObject({
      elapsedSeconds: 0,
      remainingSeconds: 1500,
      complete: false,
    })
  })

  it('preserves optional task context through focus completion', () => {
    const record = createStudySessionRecord(focusTimer({ taskId: 'task-1' }), START + 60_000, SESSION_COMPLETION_STATES.FINISHED_EARLY)
    expect(record.taskId).toBe('task-1')
    expect(createStudySessionRecord(focusTimer(), START + 60_000, SESSION_COMPLETION_STATES.FINISHED_EARLY).taskId).toBeNull()
  })

  it('calculates pause and resume without counting paused time', () => {
    const paused = pauseTimer(focusTimer(), START + 60_000)
    expect(timerSnapshot(paused, START + 10 * 60_000).elapsedSeconds).toBe(60)

    const resumed = resumeTimer(paused, START + 5 * 60_000)
    expect(resumed.totalPausedDurationMs).toBe(4 * 60_000)
    expect(timerSnapshot(resumed, START + 6 * 60_000).elapsedSeconds).toBe(120)
  })

  it('tracks multiple pauses accurately', () => {
    const firstPause = pauseTimer(focusTimer(), START + 30_000)
    const firstResume = resumeTimer(firstPause, START + 90_000)
    const secondPause = pauseTimer(firstResume, START + 120_000)
    const secondResume = resumeTimer(secondPause, START + 180_000)

    expect(secondResume.pauseCount).toBe(2)
    expect(secondResume.totalPausedDurationMs).toBe(120_000)
    expect(timerSnapshot(secondResume, START + 240_000).elapsedSeconds).toBe(120)
  })

  it('uses timestamps when the tab was inactive', () => {
    const timer = focusTimer()
    expect(timerSnapshot(timer, START + 17 * 60_000 + 12_000).elapsedSeconds).toBe(1032)
    expect(timerSnapshot(timer, START + 17 * 60_000 + 12_000).remainingSeconds).toBe(468)
  })

  it('finishes normally with planned focused seconds', () => {
    const timer = focusTimer()
    const record = createStudySessionRecord(
      timer,
      START + 25 * 60_000 + 3_000,
      SESSION_COMPLETION_STATES.COMPLETED,
    )

    expect(record.actualFocusedSeconds).toBe(1500)
    expect(record.completionState).toBe('COMPLETED')
    expect(record.moduleCode).toBe('AB1201')
  })

  it('retains actual focused seconds when finished early', () => {
    const timer = focusTimer()
    const record = createStudySessionRecord(
      timer,
      START + 7 * 60_000 + 24_000,
      SESSION_COMPLETION_STATES.FINISHED_EARLY,
    )

    expect(record.actualFocusedSeconds).toBe(444)
    expect(record.plannedFocusedSeconds).toBe(1500)
  })

  it('retains elapsed focus when cancelled', () => {
    const timer = focusTimer()
    const record = createStudySessionRecord(
      timer,
      START + 80_000,
      SESSION_COMPLETION_STATES.CANCELLED,
    )

    expect(record.actualFocusedSeconds).toBe(80)
    expect(record.completionState).toBe('CANCELLED')
  })

  it('does not create study records for break time', () => {
    const breakTimer = createBreakTimerFromFocus(focusTimer(), START + 25 * 60_000, true)
    expect(breakTimer.mode).toBe(TIMER_MODES.BREAK)
    expect(createStudySessionRecord(breakTimer, START + 30 * 60_000)).toBeNull()
  })

  it('restores a running timer from persisted timestamp state', () => {
    const persisted = JSON.parse(JSON.stringify(focusTimer()))
    const restored = timerSnapshot(persisted, START + 8 * 60_000)
    expect(restored.elapsedSeconds).toBe(480)
    expect(restored.remainingSeconds).toBe(1020)
  })

  it('detects completion immediately after reload', () => {
    const persisted = JSON.parse(JSON.stringify(focusTimer()))
    expect(timerSnapshot(persisted, START + 30 * 60_000).complete).toBe(true)
    expect(timerSnapshot(persisted, START + 30 * 60_000).remainingSeconds).toBe(0)
  })

  it('never returns negative remaining time', () => {
    const snapshot = timerSnapshot(focusTimer(), START + 10 * 60 * 60_000)
    expect(snapshot.remainingSeconds).toBe(0)
    expect(snapshot.elapsedSeconds).toBe(1500)
    expect(snapshot.progress).toBe(1)
  })

  it('preserves a paused timer across reloads', () => {
    const paused = pauseTimer(focusTimer(), START + 100_000)
    const persisted = JSON.parse(JSON.stringify(paused))
    expect(timerSnapshot(persisted, START + 500_000).elapsedSeconds).toBe(100)
    expect(persisted.status).toBe(TIMER_STATUSES.PAUSED)
  })

  it('creates a ready break when auto-start is disabled', () => {
    const breakTimer = createBreakTimerFromFocus(focusTimer({ autoStartBreak: false }), START + 1_500_000, false)
    expect(breakTimer.status).toBe(TIMER_STATUSES.READY)
    expect(timerSnapshot(breakTimer, START + 1_800_000).elapsedSeconds).toBe(0)

    const started = startReadyTimer(breakTimer, START + 1_800_000)
    expect(started.status).toBe(TIMER_STATUSES.RUNNING)
    expect(timerSnapshot(started, START + 1_860_000).elapsedSeconds).toBe(60)
  })

  it('validates custom durations', () => {
    expect(validateCustomDurations({ focusMinutes: 45, breakMinutes: 8 })).toMatchObject({
      valid: true,
      focusDurationSeconds: 2700,
      breakDurationSeconds: 480,
    })
    expect(validateCustomDurations({ focusMinutes: 0, breakMinutes: 121 })).toMatchObject({
      valid: false,
      errors: {
        focusMinutes: expect.any(String),
        breakMinutes: expect.any(String),
      },
    })
  })

  it('supports general-study sessions', () => {
    const timer = focusTimer({
      module: { enrolmentId: null, code: 'GENERAL', title: 'General study' },
    })
    const record = createStudySessionRecord(timer, START + 60_000, SESSION_COMPLETION_STATES.FINISHED_EARLY)
    expect(record.moduleEnrolmentId).toBeNull()
    expect(record.moduleCode).toBe('GENERAL')
    expect(record.moduleTitle).toBe('General study')
  })
})
