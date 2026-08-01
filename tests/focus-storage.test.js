import { describe, expect, it } from 'vitest'
import { createFocusStorage } from '../app/utils/focus-storage.client.js'
import {
  SESSION_COMPLETION_STATES,
  TIMER_MODES,
  createStudySessionRecord,
  createTimerState,
  pauseTimer,
} from '../shared/focus/timer.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    keys: () => [...values.keys()],
  }
}

const START = new Date('2026-08-01T02:00:00.000Z').getTime()

function timer(userId = 'user-1') {
  return createTimerState({
    sessionId: `session-${userId}`,
    userId,
    mode: TIMER_MODES.FOCUS,
    now: START,
    plannedDurationSeconds: 60,
    focusDurationSeconds: 60,
    breakDurationSeconds: 0,
    module: { code: 'GENERAL', title: 'General study' },
  })
}

describe('focus local storage', () => {
  it('recovers safely from corrupt local storage', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    local.setItem(storage.keyForUser('user-1'), '{bad json')

    expect(storage.load('user-1')).toMatchObject({ activeTimer: null, sessions: [] })
    expect(local.getItem(storage.keyForUser('user-1'))).toBeNull()
  })

  it('drops unsupported storage versions safely', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    local.setItem(storage.keyForUser('user-1'), JSON.stringify({ version: 99, sessions: [{ id: 'old' }] }))

    expect(storage.load('user-1')).toMatchObject({ activeTimer: null, sessions: [] })
    expect(local.getItem(storage.keyForUser('user-1'))).toBeNull()
  })

  it('scopes every focus state to the authenticated user', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    storage.saveActiveTimer('user-1', timer('user-1'))
    storage.saveActiveTimer('user-2', timer('user-2'))

    expect(storage.load('user-1').activeTimer.userId).toBe('user-1')
    expect(storage.load('user-2').activeTimer.userId).toBe('user-2')
    expect(local.keys()).toEqual(expect.arrayContaining([
      'northstar:focus:user:user-1',
      'northstar:focus:user:user-2',
    ]))
  })

  it('does not expose another account history after switching users', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    const first = createStudySessionRecord(timer('user-1'), START + 60_000, SESSION_COMPLETION_STATES.COMPLETED)
    storage.addSession('user-1', first)

    expect(storage.load('user-2').sessions).toEqual([])
    expect(storage.load('user-1').sessions).toHaveLength(1)
  })

  it('restores paused active timer state without advancing it', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    storage.saveActiveTimer('user-1', pauseTimer(timer('user-1'), START + 20_000))

    const restored = storage.load('user-1').activeTimer
    expect(restored.status).toBe('PAUSED')
    expect(restored.pausedAt).toBe('2026-08-01T02:00:20.000Z')
  })

  it('completes a focus phase and replaces the active timer in one stored state', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    const active = timer('user-1')
    const record = createStudySessionRecord(active, START + 60_000, SESSION_COMPLETION_STATES.COMPLETED)
    const breakTimer = createTimerState({
      sessionId: active.sessionId,
      userId: 'user-1',
      mode: TIMER_MODES.BREAK,
      now: START + 60_000,
      plannedDurationSeconds: 30,
      focusDurationSeconds: 60,
      breakDurationSeconds: 30,
    })

    const state = storage.completeFocusPhase('user-1', record, breakTimer)
    expect(state.sessions).toHaveLength(1)
    expect(state.activeTimer.mode).toBe('BREAK')
  })

  it('never creates duplicate completed records for one timer', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    const active = timer('user-1')
    const record = createStudySessionRecord(active, START + 60_000, SESSION_COMPLETION_STATES.COMPLETED)

    storage.completeFocusPhase('user-1', record, null)
    storage.completeFocusPhase('user-1', record, null)

    expect(storage.load('user-1').sessions).toHaveLength(1)
  })

  it('drops records whose stored user ID does not match the scoped key', () => {
    const local = memoryStorage()
    const storage = createFocusStorage(local)
    const foreign = createStudySessionRecord(timer('user-1'), START + 60_000, SESSION_COMPLETION_STATES.COMPLETED)
    local.setItem(storage.keyForUser('user-2'), JSON.stringify({
      version: 1,
      activeTimer: null,
      sessions: [foreign],
      preferences: {},
    }))

    expect(storage.load('user-2').sessions).toEqual([])
  })
})
