<script setup>
const props = defineProps({
  sessions: { type: Array, default: () => [] },
  moduleBreakdown: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
  range: { type: String, default: 'ALL' },
  moduleKey: { type: String, default: 'ALL' },
})

const emit = defineEmits([
  'update:range',
  'update:module-key',
  'delete-session',
  'clear-history',
])

const stateLabels = {
  COMPLETED: 'Completed',
  FINISHED_EARLY: 'Finished early',
  CANCELLED: 'Cancelled',
}

function duration(seconds) {
  const value = Number(seconds) || 0
  if (value < 60) return '<1 min'
  return `${Math.round(value / 60)} min`
}

function dateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function moduleLabel(session) {
  if (!session.moduleCode || session.moduleCode === 'GENERAL') return 'General study'
  return [session.moduleCode, session.moduleTitle].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="focus-history-card" aria-labelledby="focus-history-title">
    <div class="focus-history-card__heading">
      <div>
        <p class="focus-eyebrow">Local history</p>
        <h2 id="focus-history-title">Recent study sessions</h2>
      </div>
      <details class="focus-secondary-menu">
        <summary aria-label="Open focus history options">
          <UIcon name="i-lucide-ellipsis" aria-hidden="true" />
        </summary>
        <button type="button" @click="emit('clear-history')">Clear local history</button>
      </details>
    </div>

    <div class="focus-history-filters" aria-label="Filter study history">
      <label for="focus-history-range">
        Period
        <select id="focus-history-range" :value="range" @change="emit('update:range', $event.target.value)">
          <option value="ALL">All time</option>
          <option value="TODAY">Today</option>
          <option value="WEEK">This week</option>
        </select>
      </label>
      <label for="focus-history-module">
        Module
        <select id="focus-history-module" :value="moduleKey" @change="emit('update:module-key', $event.target.value)">
          <option value="ALL">All modules</option>
          <option v-for="module in moduleOptions" :key="module.key" :value="module.key">
            {{ module.label }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="sessions.length" class="focus-session-list">
      <article v-for="session in sessions" :key="session.id" class="focus-session-row">
        <div class="focus-session-row__main">
          <div>
            <strong>{{ moduleLabel(session) }}</strong>
            <span>{{ stateLabels[session.completionState] || session.completionState }}</span>
          </div>
          <p v-if="session.studyGoal">{{ session.studyGoal }}</p>
          <small>{{ dateTime(session.endedAt) }} · {{ session.pauseCount }} pause{{ session.pauseCount === 1 ? '' : 's' }}</small>
        </div>
        <strong class="focus-session-row__duration">{{ duration(session.actualFocusedSeconds) }}</strong>
        <button
          type="button"
          class="focus-icon-button"
          :aria-label="`Delete ${moduleLabel(session)} session from ${dateTime(session.endedAt)}`"
          @click="emit('delete-session', session.id)"
        >
          <UIcon name="i-lucide-trash-2" aria-hidden="true" />
        </button>
      </article>
    </div>
    <p v-else class="focus-empty-state">No study sessions match these filters yet.</p>

    <div class="focus-module-breakdown">
      <div class="focus-module-breakdown__heading">
        <h3>Focused time by module</h3>
        <span>Current filters</span>
      </div>
      <div v-if="moduleBreakdown.length" class="focus-module-breakdown__list">
        <div v-for="module in moduleBreakdown" :key="module.key">
          <span>{{ module.label }}</span>
          <strong>{{ duration(module.focusedSeconds) }}</strong>
        </div>
      </div>
      <p v-else>No module totals to show.</p>
    </div>
  </section>
</template>
