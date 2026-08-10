<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({
  title: 'Focus Timer · Northstar',
  description: 'Run accurate focus sessions and review browser-local study time.',
})

const {
  activeTimer,
  snapshot,
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
} = useFocusTimer()

function confirmCancel() {
  const message = activeTimer.value?.mode === 'FOCUS' && snapshot.value.elapsedSeconds > 0
    ? 'Cancel this focus session? The focused time already recorded will be retained as a cancelled session.'
    : 'Cancel the current timer?'
  if (window.confirm(message)) cancelSession()
}

function confirmReset() {
  const message = hasRecordedFocusTime.value
    ? 'Reset and permanently discard the focused time in this active session?'
    : 'Reset the current timer?'
  if (window.confirm(message)) resetTimer()
}

function confirmDelete(sessionId) {
  if (window.confirm('Delete this local study-session record? This cannot be undone.')) {
    deleteSession(sessionId)
  }
}

function confirmClearHistory() {
  if (window.confirm('Clear all local focus history for this account on this browser? This cannot be undone.')) {
    clearHistory()
  }
}
</script>

<template>
  <main class="app-page v2-page focus-page">
    <header class="v2-page-heading focus-page__header">
      <div>
        <p>Focus</p>
        <h1>Timer and recent study</h1>
      </div>
      <span class="focus-local-label">
        <UIcon name="i-lucide-hard-drive" aria-hidden="true" />
        Stored only in this browser
      </span>
    </header>

    <div v-if="!initialized" class="focus-loading" aria-live="polite">
      Loading your focus workspace…
    </div>

    <template v-else>
      <FocusSummaryCards :summary="summary" />

      <div class="focus-workspace-grid">
        <FocusTimerPanel
          :timer="activeTimer"
          :snapshot="snapshot"
          :preferences="preferences"
          :modules="moduleOptions"
          :modules-loading="modulesLoading"
          :modules-error="modulesError"
          :error="error"
          :restored-notice="restoredNotice"
          :status-message="statusMessage"
          :notification-permission="notificationPermission"
          @patch-preferences="patchPreferences"
          @start-focus="startFocusSession"
          @start-break="startBreak"
          @pause="pause"
          @resume="resume"
          @finish-early="finishEarly"
          @cancel="confirmCancel"
          @skip-break="skipBreak"
          @reset="confirmReset"
          @toggle-notifications="setNotificationsEnabled"
          @toggle-sound="setSoundEnabled"
        />

        <FocusHistory
          :sessions="recentSessions"
          :module-breakdown="moduleBreakdown"
          :module-options="historyModuleOptions"
          :range="historyRange"
          :module-key="historyModuleKey"
          @update:range="historyRange = $event"
          @update:module-key="historyModuleKey = $event"
          @delete-session="confirmDelete"
          @clear-history="confirmClearHistory"
        />
      </div>
    </template>
  </main>
</template>

<style src="~/assets/css/focus.css"></style>
