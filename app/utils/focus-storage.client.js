import {
  FOCUS_STORAGE_VERSION,
  SESSION_COMPLETION_STATES,
  TIMER_MODES,
  TIMER_STATUSES,
} from '~~/shared/focus/timer'

export const DEFAULT_FOCUS_PREFERENCES = Object.freeze({
  preset: '25_5',
  customFocusMinutes: 25,
  customBreakMinutes: 5,
  autoStartBreak: false,
  notificationsEnabled: false,
  soundEnabled: false,
  selectedModuleKey: 'general',
  selectedModule: {
    enrolmentId: null,
    code: 'GENERAL',
    title: 'General study',
  },
  goal: '',
})

const STORAGE_PREFIX = 'northstar:focus:user:'
const MAX_HISTORY_RECORDS = 2_000

function keyForUser(userId) {
  if (!userId) throw new TypeError('A user ID is required for focus storage.')
  return `${STORAGE_PREFIX}${encodeURIComponent(String(userId))}`
}

function clonePreferences(value = {}) {
  return {
    ...DEFAULT_FOCUS_PREFERENCES,
    ...value,
    selectedModule: {
      ...DEFAULT_FOCUS_PREFERENCES.selectedModule,
      ...(value.selectedModule || {}),
    },
  }
}

function emptyState() {
  return {
    version: FOCUS_STORAGE_VERSION,
    activeTimer: null,
    sessions: [],
    preferences: clonePreferences(),
  }
}

function finiteNonNegative(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function validIso(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function sanitizeModule(module) {
  if (!module || typeof module !== 'object') return null
  return {
    enrolmentId: module.enrolmentId ? String(module.enrolmentId) : null,
    code: module.code ? String(module.code).slice(0, 32) : null,
    title: module.title ? String(module.title).slice(0, 160) : null,
  }
}

function sanitizeActiveTimer(timer, userId) {
  if (!timer || typeof timer !== 'object') return null
  if (String(timer.userId || '') !== String(userId)) return null
  if (!timer.sessionId || !Object.values(TIMER_MODES).includes(timer.mode)) return null
  if (!Object.values(TIMER_STATUSES).includes(timer.status)) return null

  const startedAt = timer.startedAt ? validIso(timer.startedAt) : null
  const pausedAt = timer.pausedAt ? validIso(timer.pausedAt) : null
  const createdAt = validIso(timer.createdAt)
  const focusStartedAt = timer.focusStartedAt ? validIso(timer.focusStartedAt) : null
  const plannedDurationSeconds = Math.floor(finiteNonNegative(timer.plannedDurationSeconds))

  if (plannedDurationSeconds < 1 || !createdAt) return null
  if (timer.status !== TIMER_STATUSES.READY && !startedAt) return null
  if (timer.status === TIMER_STATUSES.PAUSED && !pausedAt) return null

  return {
    version: FOCUS_STORAGE_VERSION,
    sessionId: String(timer.sessionId),
    userId: String(userId),
    mode: timer.mode,
    status: timer.status,
    startedAt,
    pausedAt,
    totalPausedDurationMs: Math.floor(finiteNonNegative(timer.totalPausedDurationMs)),
    plannedDurationSeconds,
    focusDurationSeconds: Math.floor(finiteNonNegative(timer.focusDurationSeconds)),
    breakDurationSeconds: Math.floor(finiteNonNegative(timer.breakDurationSeconds)),
    module: sanitizeModule(timer.module),
    goal: String(timer.goal || '').trim().slice(0, 240),
    autoStartBreak: Boolean(timer.autoStartBreak),
    pauseCount: Math.floor(finiteNonNegative(timer.pauseCount)),
    focusStartedAt,
    createdAt,
  }
}

function sanitizeSession(record, userId) {
  if (!record || typeof record !== 'object') return null
  if (!record.id || String(record.userId || '') !== String(userId)) return null
  if (!Object.values(SESSION_COMPLETION_STATES).includes(record.completionState)) return null

  const startedAt = validIso(record.startedAt)
  const endedAt = validIso(record.endedAt)
  const createdAt = validIso(record.createdAt)
  if (!startedAt || !endedAt || !createdAt) return null

  return {
    id: String(record.id),
    userId: String(userId),
    moduleEnrolmentId: record.moduleEnrolmentId ? String(record.moduleEnrolmentId) : null,
    moduleCode: record.moduleCode ? String(record.moduleCode).slice(0, 32) : null,
    moduleTitle: record.moduleTitle ? String(record.moduleTitle).slice(0, 160) : null,
    studyGoal: String(record.studyGoal || '').trim().slice(0, 240),
    startedAt,
    endedAt,
    actualFocusedSeconds: Math.floor(finiteNonNegative(record.actualFocusedSeconds)),
    plannedFocusedSeconds: Math.floor(finiteNonNegative(record.plannedFocusedSeconds)),
    completionState: record.completionState,
    pauseCount: Math.floor(finiteNonNegative(record.pauseCount)),
    createdAt,
  }
}

function sanitizePreferences(value) {
  const preferences = clonePreferences(value && typeof value === 'object' ? value : {})
  const preset = ['25_5', '50_10', 'CUSTOM'].includes(preferences.preset)
    ? preferences.preset
    : DEFAULT_FOCUS_PREFERENCES.preset

  return {
    preset,
    customFocusMinutes: Math.min(240, Math.max(1, Number(preferences.customFocusMinutes) || 25)),
    customBreakMinutes: Math.min(120, Math.max(0, Number(preferences.customBreakMinutes) || 0)),
    autoStartBreak: Boolean(preferences.autoStartBreak),
    notificationsEnabled: Boolean(preferences.notificationsEnabled),
    soundEnabled: Boolean(preferences.soundEnabled),
    selectedModuleKey: String(preferences.selectedModuleKey || 'general').slice(0, 200),
    selectedModule: sanitizeModule(preferences.selectedModule) || clonePreferences().selectedModule,
    goal: String(preferences.goal || '').slice(0, 240),
  }
}

function sanitizeState(value, userId) {
  if (!value || typeof value !== 'object' || value.version !== FOCUS_STORAGE_VERSION) {
    return emptyState()
  }

  const seen = new Set()
  const sessions = []
  for (const candidate of Array.isArray(value.sessions) ? value.sessions : []) {
    const session = sanitizeSession(candidate, userId)
    if (!session || seen.has(session.id)) continue
    seen.add(session.id)
    sessions.push(session)
    if (sessions.length >= MAX_HISTORY_RECORDS) break
  }

  sessions.sort((left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime())

  return {
    version: FOCUS_STORAGE_VERSION,
    activeTimer: sanitizeActiveTimer(value.activeTimer, userId),
    sessions,
    preferences: sanitizePreferences(value.preferences),
  }
}

export function createFocusStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('A local-storage-compatible object is required.')
  }

  function read(userId) {
    const key = keyForUser(userId)
    const raw = storage.getItem(key)
    if (!raw) return emptyState()

    try {
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.version !== FOCUS_STORAGE_VERSION) {
        storage.removeItem?.(key)
        return emptyState()
      }
      return sanitizeState(parsed, userId)
    } catch {
      storage.removeItem?.(key)
      return emptyState()
    }
  }

  function write(userId, state) {
    const clean = sanitizeState({ ...state, version: FOCUS_STORAGE_VERSION }, userId)
    storage.setItem(keyForUser(userId), JSON.stringify(clean))
    return clean
  }

  function update(userId, updater) {
    const current = read(userId)
    const next = updater(current) || current
    return write(userId, next)
  }

  return {
    keyForUser,
    load(userId) {
      return read(userId)
    },
    saveActiveTimer(userId, activeTimer) {
      return update(userId, state => ({ ...state, activeTimer }))
    },
    savePreferences(userId, preferences) {
      return update(userId, state => ({ ...state, preferences }))
    },
    addSession(userId, session) {
      return update(userId, (state) => {
        if (state.sessions.some(item => item.id === session?.id)) return state
        return { ...state, sessions: [session, ...state.sessions] }
      })
    },
    completeFocusPhase(userId, session, nextActiveTimer = null) {
      return update(userId, (state) => {
        const sessions = session && !state.sessions.some(item => item.id === session.id)
          ? [session, ...state.sessions]
          : state.sessions
        return { ...state, sessions, activeTimer: nextActiveTimer }
      })
    },
    deleteSession(userId, sessionId) {
      return update(userId, state => ({
        ...state,
        sessions: state.sessions.filter(session => session.id !== sessionId),
      }))
    },
    clearHistory(userId) {
      return update(userId, state => ({ ...state, sessions: [] }))
    },
    clearActiveTimer(userId) {
      return update(userId, state => ({ ...state, activeTimer: null }))
    },
    removeUserData(userId) {
      storage.removeItem?.(keyForUser(userId))
    },
  }
}
