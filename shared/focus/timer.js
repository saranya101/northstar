export const FOCUS_STORAGE_VERSION = 1

export const TIMER_MODES = Object.freeze({
  FOCUS: 'FOCUS',
  BREAK: 'BREAK',
})

export const TIMER_STATUSES = Object.freeze({
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
})

export const SESSION_COMPLETION_STATES = Object.freeze({
  COMPLETED: 'COMPLETED',
  FINISHED_EARLY: 'FINISHED_EARLY',
  CANCELLED: 'CANCELLED',
})

const SECOND_MS = 1_000
const MAX_FOCUS_MINUTES = 240
const MAX_BREAK_MINUTES = 120

function validDateMilliseconds(value) {
  const milliseconds = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : new Date(value).getTime()

  if (!Number.isFinite(milliseconds)) {
    throw new TypeError('A valid timestamp is required.')
  }

  return milliseconds
}

function iso(value) {
  return new Date(validDateMilliseconds(value)).toISOString()
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback
}

export function validateCustomDurations({ focusMinutes, breakMinutes }) {
  const focus = Number(focusMinutes)
  const rest = Number(breakMinutes)
  const errors = {}

  if (!Number.isFinite(focus) || focus < 1 || focus > MAX_FOCUS_MINUTES) {
    errors.focusMinutes = `Focus duration must be between 1 and ${MAX_FOCUS_MINUTES} minutes.`
  }

  if (!Number.isFinite(rest) || rest < 0 || rest > MAX_BREAK_MINUTES) {
    errors.breakMinutes = `Break duration must be between 0 and ${MAX_BREAK_MINUTES} minutes.`
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    focusDurationSeconds: errors.focusMinutes ? null : Math.round(focus * 60),
    breakDurationSeconds: errors.breakMinutes ? null : Math.round(rest * 60),
  }
}

export function createSessionId(now = Date.now(), random = Math.random) {
  const timestamp = validDateMilliseconds(now).toString(36)
  const entropy = Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * 2_176_782_336)
    .toString(36)
    .padStart(6, '0')

  return `focus_${timestamp}_${entropy}`
}

export function createTimerState({
  sessionId,
  userId,
  mode = TIMER_MODES.FOCUS,
  status = TIMER_STATUSES.RUNNING,
  now = Date.now(),
  plannedDurationSeconds,
  focusDurationSeconds,
  breakDurationSeconds,
  module = null,
  taskId = null,
  goal = '',
  autoStartBreak = false,
  focusStartedAt = null,
  pauseCount = 0,
}) {
  if (!sessionId || !userId) {
    throw new TypeError('A session ID and user ID are required.')
  }

  if (!Object.values(TIMER_MODES).includes(mode)) {
    throw new TypeError('Unsupported timer mode.')
  }

  if (!Object.values(TIMER_STATUSES).includes(status)) {
    throw new TypeError('Unsupported timer status.')
  }

  const planned = nonNegativeInteger(plannedDurationSeconds)
  if (planned < 1) {
    throw new RangeError('Planned duration must be at least one second.')
  }

  const timestamp = iso(now)
  const ready = status === TIMER_STATUSES.READY

  return {
    version: FOCUS_STORAGE_VERSION,
    sessionId: String(sessionId),
    userId: String(userId),
    mode,
    status,
    startedAt: ready ? null : timestamp,
    pausedAt: status === TIMER_STATUSES.PAUSED ? timestamp : null,
    totalPausedDurationMs: 0,
    plannedDurationSeconds: planned,
    focusDurationSeconds: nonNegativeInteger(focusDurationSeconds, mode === TIMER_MODES.FOCUS ? planned : 0),
    breakDurationSeconds: nonNegativeInteger(breakDurationSeconds, mode === TIMER_MODES.BREAK ? planned : 0),
    module: module
      ? {
          enrolmentId: module.enrolmentId ? String(module.enrolmentId) : null,
          code: module.code ? String(module.code) : null,
          title: module.title ? String(module.title) : null,
        }
      : null,
    taskId: taskId ? String(taskId).slice(0, 200) : null,
    goal: String(goal || '').trim().slice(0, 240),
    autoStartBreak: Boolean(autoStartBreak),
    pauseCount: nonNegativeInteger(pauseCount),
    focusStartedAt: focusStartedAt
      ? iso(focusStartedAt)
      : mode === TIMER_MODES.FOCUS
        ? timestamp
        : null,
    createdAt: timestamp,
  }
}

export function elapsedTimerMilliseconds(timer, now = Date.now()) {
  if (!timer?.startedAt || timer.status === TIMER_STATUSES.READY) {
    return 0
  }

  const startedAt = validDateMilliseconds(timer.startedAt)
  const current = timer.status === TIMER_STATUSES.PAUSED && timer.pausedAt
    ? validDateMilliseconds(timer.pausedAt)
    : validDateMilliseconds(now)
  const paused = nonNegativeInteger(timer.totalPausedDurationMs)

  return Math.max(0, current - startedAt - paused)
}

export function timerSnapshot(timer, now = Date.now()) {
  if (!timer) {
    return {
      elapsedMilliseconds: 0,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      progress: 0,
      complete: false,
    }
  }

  const plannedMilliseconds = Math.max(1, nonNegativeInteger(timer.plannedDurationSeconds) * SECOND_MS)
  const rawElapsed = elapsedTimerMilliseconds(timer, now)
  const elapsedMilliseconds = Math.min(plannedMilliseconds, rawElapsed)
  const elapsedSeconds = Math.min(
    nonNegativeInteger(timer.plannedDurationSeconds),
    Math.floor(elapsedMilliseconds / SECOND_MS),
  )
  const remainingSeconds = Math.max(
    0,
    Math.ceil((plannedMilliseconds - elapsedMilliseconds) / SECOND_MS),
  )

  return {
    elapsedMilliseconds,
    elapsedSeconds,
    remainingSeconds,
    progress: Math.min(1, Math.max(0, elapsedMilliseconds / plannedMilliseconds)),
    complete: rawElapsed >= plannedMilliseconds,
  }
}

export function pauseTimer(timer, now = Date.now()) {
  if (!timer || timer.status !== TIMER_STATUSES.RUNNING) {
    return timer
  }

  return {
    ...timer,
    status: TIMER_STATUSES.PAUSED,
    pausedAt: iso(now),
    pauseCount: nonNegativeInteger(timer.pauseCount) + 1,
  }
}

export function resumeTimer(timer, now = Date.now()) {
  if (!timer || timer.status !== TIMER_STATUSES.PAUSED || !timer.pausedAt) {
    return timer
  }

  const current = validDateMilliseconds(now)
  const pausedAt = validDateMilliseconds(timer.pausedAt)
  const additionalPause = Math.max(0, current - pausedAt)

  return {
    ...timer,
    status: TIMER_STATUSES.RUNNING,
    pausedAt: null,
    totalPausedDurationMs: nonNegativeInteger(timer.totalPausedDurationMs) + additionalPause,
  }
}

export function startReadyTimer(timer, now = Date.now()) {
  if (!timer || timer.status !== TIMER_STATUSES.READY) {
    return timer
  }

  return {
    ...timer,
    status: TIMER_STATUSES.RUNNING,
    startedAt: iso(now),
    pausedAt: null,
    totalPausedDurationMs: 0,
  }
}

export function createBreakTimerFromFocus(focusTimer, now = Date.now(), autoStart = focusTimer?.autoStartBreak) {
  if (!focusTimer || focusTimer.mode !== TIMER_MODES.FOCUS) {
    throw new TypeError('A focus timer is required to create a break.')
  }

  const breakDurationSeconds = nonNegativeInteger(focusTimer.breakDurationSeconds)
  if (breakDurationSeconds < 1) {
    return null
  }

  return createTimerState({
    sessionId: focusTimer.sessionId,
    userId: focusTimer.userId,
    mode: TIMER_MODES.BREAK,
    status: autoStart ? TIMER_STATUSES.RUNNING : TIMER_STATUSES.READY,
    now,
    plannedDurationSeconds: breakDurationSeconds,
    focusDurationSeconds: focusTimer.focusDurationSeconds,
    breakDurationSeconds,
    module: focusTimer.module,
    taskId: focusTimer.taskId,
    goal: focusTimer.goal,
    autoStartBreak: focusTimer.autoStartBreak,
    focusStartedAt: focusTimer.focusStartedAt || focusTimer.startedAt,
    pauseCount: focusTimer.pauseCount,
  })
}

export function createStudySessionRecord(timer, endedAt = Date.now(), completionState = SESSION_COMPLETION_STATES.COMPLETED) {
  if (!timer || timer.mode !== TIMER_MODES.FOCUS) {
    return null
  }

  if (!Object.values(SESSION_COMPLETION_STATES).includes(completionState)) {
    throw new TypeError('Unsupported completion state.')
  }

  const endedAtMs = validDateMilliseconds(endedAt)
  const snapshot = timerSnapshot(timer, endedAtMs)
  const actualFocusedSeconds = completionState === SESSION_COMPLETION_STATES.COMPLETED
    ? nonNegativeInteger(timer.plannedDurationSeconds)
    : snapshot.elapsedSeconds

  return {
    id: String(timer.sessionId),
    userId: String(timer.userId),
    moduleEnrolmentId: timer.module?.enrolmentId || null,
    moduleCode: timer.module?.code || null,
    moduleTitle: timer.module?.title || null,
    taskId: timer.taskId || null,
    studyGoal: String(timer.goal || '').trim().slice(0, 240),
    startedAt: iso(timer.focusStartedAt || timer.startedAt || endedAtMs),
    endedAt: iso(endedAtMs),
    actualFocusedSeconds: Math.max(0, actualFocusedSeconds),
    plannedFocusedSeconds: nonNegativeInteger(timer.focusDurationSeconds, timer.plannedDurationSeconds),
    completionState,
    pauseCount: nonNegativeInteger(timer.pauseCount),
    createdAt: iso(endedAtMs),
  }
}
