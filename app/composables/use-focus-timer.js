import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  SESSION_COMPLETION_STATES,
  TIMER_MODES,
  TIMER_STATUSES,
  createBreakTimerFromFocus,
  createSessionId,
  createStudySessionRecord,
  createTimerState,
  pauseTimer,
  resumeTimer,
  startReadyTimer,
  timerSnapshot,
  validateCustomDurations,
} from '~~/shared/focus/timer'
import {
  ALL_MODULES_FILTER,
  HISTORY_RANGES,
  filterFocusSessions,
  groupFocusSessionsByModule,
  recentFocusSessions,
  summarizeFocusSessions,
} from '~~/shared/focus/history'
import { createFocusStorage, DEFAULT_FOCUS_PREFERENCES } from '~/utils/focus-storage.client'
import {
  playCompletionSound,
  primeCompletionSound,
  requestCompletionNotificationPermission,
  showCompletionNotification,
} from '~/utils/focus-effects.client'

const PRESET_DURATIONS = Object.freeze({
  '25_5': { focusMinutes: 25, breakMinutes: 5 },
  '50_10': { focusMinutes: 50, breakMinutes: 10 },
})

function clonePreferences(value = DEFAULT_FOCUS_PREFERENCES) {
  return {
    ...DEFAULT_FOCUS_PREFERENCES,
    ...value,
    selectedModule: {
      ...DEFAULT_FOCUS_PREFERENCES.selectedModule,
      ...(value.selectedModule || {}),
    },
  }
}

function normalizeModule(item) {
  const enrolmentId = item?.enrolmentId || item?.enrolment?.id || item?.id || null
  const code = item?.code || item?.module?.code || item?.moduleCode || null
  const title = item?.title || item?.module?.title || item?.moduleTitle || null

  if (!enrolmentId || !code) return null
  if (item?.status && item.status !== 'ACTIVE') return null

  return {
    key: `enrolment:${enrolmentId}`,
    enrolmentId: String(enrolmentId),
    code: String(code),
    title: title ? String(title) : '',
  }
}

export function useFocusTimer() {
  const route = useRoute()
  const { user } = useCurrentSession()
  const {
    state: modulesState,
    loading: modulesLoading,
    error: modulesError,
    load: loadModules,
  } = useModules()

  const activeTimer = ref(null)
  const sessions = ref([])
  const preferences = ref(clonePreferences())
  const nowMs = ref(Date.now())
  const ownerId = ref(null)
  const restoredNotice = ref('')
  const statusMessage = ref('')
  const error = ref('')
  const historyRange = ref(HISTORY_RANGES.ALL)
  const historyModuleKey = ref(ALL_MODULES_FILTER)
  const notificationPermission = ref('default')
  const initialized = ref(false)
  const taskContextId = ref(null)

  let storage = null
  let intervalId = null
  let stopUserWatch = null
  let hydrating = false
  let reconciling = false
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') reconcileTimer(Date.now())
  }

  const snapshot = computed(() => timerSnapshot(activeTimer.value, nowMs.value))
  const hasRecordedFocusTime = computed(() =>
    activeTimer.value?.mode === TIMER_MODES.FOCUS && snapshot.value.elapsedSeconds > 0,
  )

  const moduleOptions = computed(() => {
    const source = modulesState.value?.modules || modulesState.value?.items || []
    const normalized = source.map(normalizeModule).filter(Boolean)
    const options = [
      {
        key: 'general',
        enrolmentId: null,
        code: 'GENERAL',
        title: 'General study',
      },
      ...normalized,
    ]

    const stored = preferences.value.selectedModule
    const storedKey = preferences.value.selectedModuleKey
    if (
      storedKey !== 'general'
      && stored?.code
      && !options.some(item => item.key === storedKey)
    ) {
      options.push({
        key: storedKey,
        enrolmentId: stored.enrolmentId || null,
        code: stored.code,
        title: stored.title || '',
      })
    }

    return options
  })

  const summary = computed(() => summarizeFocusSessions(sessions.value, new Date(nowMs.value), 1))
  const filteredSessions = computed(() => filterFocusSessions(sessions.value, {
    moduleKey: historyModuleKey.value,
    range: historyRange.value,
    now: new Date(nowMs.value),
    weekStartsOn: 1,
  }))
  const recentSessions = computed(() => recentFocusSessions(filteredSessions.value, 10))
  const moduleBreakdown = computed(() => groupFocusSessionsByModule(filteredSessions.value))
  const historyModuleOptions = computed(() => groupFocusSessionsByModule(sessions.value))

  function currentDurations() {
    const preset = PRESET_DURATIONS[preferences.value.preset]
    return preset || {
      focusMinutes: preferences.value.customFocusMinutes,
      breakMinutes: preferences.value.customBreakMinutes,
    }
  }

  function resetRuntime() {
    activeTimer.value = null
    sessions.value = []
    preferences.value = clonePreferences()
    ownerId.value = null
    restoredNotice.value = ''
    statusMessage.value = ''
    error.value = ''
    initialized.value = false
    taskContextId.value = null
  }

  function syncFromStoredState(state) {
    activeTimer.value = state.activeTimer
    sessions.value = state.sessions
    preferences.value = clonePreferences(state.preferences)
  }

  function persistActive(timer) {
    if (!storage || !ownerId.value) return
    const state = storage.saveActiveTimer(ownerId.value, timer)
    activeTimer.value = state.activeTimer
  }

  function selectedModuleSnapshot() {
    const selected = moduleOptions.value.find(item => item.key === preferences.value.selectedModuleKey)
      || preferences.value.selectedModule
      || moduleOptions.value[0]

    return {
      enrolmentId: selected?.enrolmentId || null,
      code: selected?.code || 'GENERAL',
      title: selected?.title || 'General study',
    }
  }

  async function runCompletionEffects(mode, module) {
    const label = module?.code && module.code !== 'GENERAL'
      ? module.code
      : 'General study'
    const focusCompleted = mode === TIMER_MODES.FOCUS
    const title = focusCompleted ? 'Focus session complete' : 'Break complete'
    const body = focusCompleted
      ? `${label}: your focused time has been recorded.`
      : 'Ready for your next focus session.'

    if (preferences.value.notificationsEnabled) {
      showCompletionNotification({ title, body })
    }
    if (preferences.value.soundEnabled) {
      await playCompletionSound()
    }
  }

  function completeFocus(timer, completionState, endedAt = Date.now()) {
    if (!storage || !ownerId.value || reconciling) return false
    reconciling = true

    try {
      const record = createStudySessionRecord(timer, endedAt, completionState)
      const nextBreak = createBreakTimerFromFocus(timer, endedAt, timer.autoStartBreak)
      const state = storage.completeFocusPhase(ownerId.value, record, nextBreak)
      sessions.value = state.sessions
      activeTimer.value = state.activeTimer
      statusMessage.value = completionState === SESSION_COMPLETION_STATES.COMPLETED
        ? 'Focus session completed and recorded.'
        : completionState === SESSION_COMPLETION_STATES.FINISHED_EARLY
          ? 'Focused time recorded. You finished early.'
          : 'Session cancelled. Recorded focus time was retained.'
      void runCompletionEffects(TIMER_MODES.FOCUS, timer.module)
      return true
    } finally {
      reconciling = false
    }
  }

  function completeBreak(timer) {
    if (!storage || !ownerId.value || reconciling) return false
    reconciling = true

    try {
      const state = storage.clearActiveTimer(ownerId.value)
      activeTimer.value = state.activeTimer
      statusMessage.value = 'Break complete. Ready for the next focus session.'
      void runCompletionEffects(TIMER_MODES.BREAK, timer.module)
      return true
    } finally {
      reconciling = false
    }
  }

  function reconcileTimer(now = Date.now(), restored = false) {
    nowMs.value = now
    const timer = activeTimer.value
    if (!timer || timer.status === TIMER_STATUSES.READY) return

    const current = timerSnapshot(timer, now)
    if (!current.complete) return

    if (timer.mode === TIMER_MODES.FOCUS) {
      completeFocus(timer, SESSION_COMPLETION_STATES.COMPLETED, now)
    } else {
      completeBreak(timer)
    }

    if (restored) {
      restoredNotice.value = timer.mode === TIMER_MODES.FOCUS
        ? 'Your focus session finished while Northstar was closed and was restored safely.'
        : 'Your break finished while Northstar was closed.'
    }
  }

  async function initializeForUser(userId) {
    if (!storage || !userId) return

    hydrating = true
    try {
      ownerId.value = String(userId)
      const state = storage.load(ownerId.value)
      syncFromStoredState(state)
      applyTaskRouteContext()
      initialized.value = true

      if (state.activeTimer) {
        restoredNotice.value = state.activeTimer.status === TIMER_STATUSES.PAUSED
          ? 'Your paused session was restored.'
          : state.activeTimer.status === TIMER_STATUSES.READY
            ? 'Your break is ready when you are.'
            : 'Your active session was restored.'
        reconcileTimer(Date.now(), true)
      }

      try {
        await loadModules()
        applyTaskRouteContext()
      } catch {
        // General study remains available when the module request fails.
      }
    } finally {
      hydrating = false
    }
  }

  function patchPreferences(patch) {
    preferences.value = clonePreferences({ ...preferences.value, ...patch })

    if (patch.selectedModuleKey) {
      const selected = moduleOptions.value.find(item => item.key === patch.selectedModuleKey)
      if (selected) preferences.value.selectedModule = selected
    }
  }

  function applyTaskRouteContext() {
    taskContextId.value = route.query.taskId ? String(route.query.taskId).slice(0, 200) : null
    const goal = route.query.goal ? String(route.query.goal).slice(0, 240) : ''
    const moduleId = route.query.module ? String(route.query.module) : ''
    const selected = moduleOptions.value.find(item => item.enrolmentId === moduleId)
    patchPreferences({ ...(goal ? { goal } : {}), ...(selected ? { selectedModuleKey: selected.key, selectedModule: selected } : {}) })
  }

  function startFocusSession() {
    error.value = ''
    statusMessage.value = ''

    if (!ownerId.value || !storage) {
      error.value = 'Your authenticated session is still loading.'
      return false
    }
    if (activeTimer.value) {
      error.value = 'Finish, cancel or reset the current timer first.'
      return false
    }

    const durations = currentDurations()
    const validation = validateCustomDurations(durations)
    if (!validation.valid) {
      error.value = Object.values(validation.errors)[0]
      return false
    }

    const now = Date.now()
    const timer = createTimerState({
      sessionId: createSessionId(now),
      userId: ownerId.value,
      mode: TIMER_MODES.FOCUS,
      status: TIMER_STATUSES.RUNNING,
      now,
      plannedDurationSeconds: validation.focusDurationSeconds,
      focusDurationSeconds: validation.focusDurationSeconds,
      breakDurationSeconds: validation.breakDurationSeconds,
      module: selectedModuleSnapshot(),
      taskId: taskContextId.value,
      goal: preferences.value.goal,
      autoStartBreak: preferences.value.autoStartBreak,
    })

    persistActive(timer)
    nowMs.value = now
    return true
  }

  function pause() {
    const timer = pauseTimer(activeTimer.value, Date.now())
    if (timer === activeTimer.value) return false
    persistActive(timer)
    nowMs.value = Date.now()
    return true
  }

  function resume() {
    const timer = resumeTimer(activeTimer.value, Date.now())
    if (timer === activeTimer.value) return false
    persistActive(timer)
    nowMs.value = Date.now()
    return true
  }

  function startBreak() {
    const timer = startReadyTimer(activeTimer.value, Date.now())
    if (timer === activeTimer.value) return false
    persistActive(timer)
    nowMs.value = Date.now()
    return true
  }

  function finishEarly() {
    const timer = activeTimer.value
    if (!timer || timer.mode !== TIMER_MODES.FOCUS || snapshot.value.elapsedSeconds < 1) return false
    return completeFocus(timer, SESSION_COMPLETION_STATES.FINISHED_EARLY, Date.now())
  }

  function cancelSession() {
    const timer = activeTimer.value
    if (!timer || !storage || !ownerId.value) return false

    if (timer.mode === TIMER_MODES.BREAK) {
      activeTimer.value = storage.clearActiveTimer(ownerId.value).activeTimer
      statusMessage.value = 'Break cancelled.'
      return true
    }

    const record = createStudySessionRecord(timer, Date.now(), SESSION_COMPLETION_STATES.CANCELLED)
    if (record.actualFocusedSeconds > 0) {
      const state = storage.completeFocusPhase(ownerId.value, record, null)
      sessions.value = state.sessions
      activeTimer.value = state.activeTimer
      statusMessage.value = 'Session cancelled. Recorded focus time was retained.'
    } else {
      activeTimer.value = storage.clearActiveTimer(ownerId.value).activeTimer
      statusMessage.value = 'Session cancelled.'
    }
    return true
  }

  function skipBreak() {
    if (activeTimer.value?.mode !== TIMER_MODES.BREAK || !storage || !ownerId.value) return false
    activeTimer.value = storage.clearActiveTimer(ownerId.value).activeTimer
    statusMessage.value = 'Break skipped.'
    return true
  }

  function resetTimer() {
    if (!storage || !ownerId.value || !activeTimer.value) return false
    activeTimer.value = storage.clearActiveTimer(ownerId.value).activeTimer
    statusMessage.value = 'Timer reset.'
    return true
  }

  function deleteSession(sessionId) {
    if (!storage || !ownerId.value) return false
    const state = storage.deleteSession(ownerId.value, sessionId)
    sessions.value = state.sessions
    return true
  }

  function clearHistory() {
    if (!storage || !ownerId.value) return false
    const state = storage.clearHistory(ownerId.value)
    sessions.value = state.sessions
    return true
  }

  async function setNotificationsEnabled(enabled) {
    if (!enabled) {
      notificationPermission.value = globalThis.Notification?.permission || 'default'
      patchPreferences({ notificationsEnabled: false })
      return true
    }

    const permission = await requestCompletionNotificationPermission()
    notificationPermission.value = permission
    const granted = permission === 'granted'
    patchPreferences({ notificationsEnabled: granted })
    if (!granted) statusMessage.value = 'Browser notifications are unavailable or were denied. The timer will continue normally.'
    return granted
  }

  async function setSoundEnabled(enabled) {
    if (!enabled) {
      patchPreferences({ soundEnabled: false })
      return true
    }

    const ready = await primeCompletionSound()
    patchPreferences({ soundEnabled: ready })
    if (!ready) statusMessage.value = 'Completion sound is unavailable in this browser. The timer will continue normally.'
    return ready
  }

  watch(preferences, (value) => {
    if (hydrating || !storage || !ownerId.value) return
    storage.savePreferences(ownerId.value, value)
  }, { deep: true })

  onMounted(() => {
    storage = createFocusStorage(window.localStorage)
    notificationPermission.value = globalThis.Notification?.permission || 'unsupported'

    stopUserWatch = watch(
      () => user.value?.id,
      async (nextUserId, previousUserId) => {
        if (String(nextUserId || '') === String(previousUserId || '') && initialized.value) return
        hydrating = true
        resetRuntime()
        hydrating = false
        if (nextUserId) await initializeForUser(nextUserId)
      },
      { immediate: true, flush: 'sync' },
    )

    intervalId = window.setInterval(() => reconcileTimer(Date.now()), 1_000)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    if (intervalId) window.clearInterval(intervalId)
    stopUserWatch?.()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    TIMER_MODES,
    TIMER_STATUSES,
    HISTORY_RANGES,
    ALL_MODULES_FILTER,
    activeTimer,
    snapshot,
    sessions,
    preferences,
    moduleOptions,
    modulesLoading,
    modulesError,
    summary,
    recentSessions,
    moduleBreakdown,
    historyModuleOptions,
    historyRange,
    historyModuleKey,
    restoredNotice,
    statusMessage,
    notificationPermission,
    error,
    initialized,
    taskContextId,
    hasRecordedFocusTime,
    patchPreferences,
    startFocusSession,
    startBreak,
    pause,
    resume,
    finishEarly,
    cancelSession,
    skipBreak,
    resetTimer,
    deleteSession,
    clearHistory,
    setNotificationsEnabled,
    setSoundEnabled,
    reconcileTimer,
  }
}
