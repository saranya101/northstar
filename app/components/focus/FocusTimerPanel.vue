<script setup>
import { computed } from 'vue'

const props = defineProps({
  timer: { type: Object, default: null },
  snapshot: { type: Object, required: true },
  preferences: { type: Object, required: true },
  modules: { type: Array, default: () => [] },
  modulesLoading: { type: Boolean, default: false },
  modulesError: { type: [String, Object], default: '' },
  error: { type: String, default: '' },
  restoredNotice: { type: String, default: '' },
  statusMessage: { type: String, default: '' },
  notificationPermission: { type: String, default: 'default' },
})

const emit = defineEmits([
  'patch-preferences',
  'start-focus',
  'start-break',
  'pause',
  'resume',
  'finish-early',
  'cancel',
  'skip-break',
  'reset',
  'toggle-notifications',
  'toggle-sound',
])

const isFocus = computed(() => !props.timer || props.timer.mode === 'FOCUS')
const modeLabel = computed(() => isFocus.value ? 'Focus' : 'Break')
const statusLabel = computed(() => {
  if (!props.timer) return 'Ready'
  if (props.timer.status === 'READY') return 'Waiting to start'
  if (props.timer.status === 'PAUSED') return 'Paused'
  return 'Running'
})
const selectedModuleLabel = computed(() => {
  const module = props.timer?.module || props.preferences.selectedModule
  if (!module?.code || module.code === 'GENERAL') return 'General study'
  return [module.code, module.title].filter(Boolean).join(' · ')
})

function clock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safe / 60)
  const remainder = Math.floor(safe % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function patch(key, value) {
  emit('patch-preferences', { [key]: value })
}
</script>

<template>
  <section class="focus-timer-card" aria-labelledby="focus-timer-title">
    <div class="focus-timer-card__heading">
      <div>
        <p class="focus-eyebrow">Study session</p>
        <h2 id="focus-timer-title">{{ timer ? `${modeLabel} timer` : 'Start a focus session' }}</h2>
      </div>
      <span class="focus-mode-badge" :data-mode="timer?.mode || 'FOCUS'">
        {{ modeLabel }} · {{ statusLabel }}
      </span>
    </div>

    <p v-if="restoredNotice" class="focus-notice" role="status">
      <UIcon name="i-lucide-history" aria-hidden="true" />
      {{ restoredNotice }}
    </p>

    <p v-if="error" class="focus-alert focus-alert--error" role="alert">{{ error }}</p>
    <p v-else-if="statusMessage" class="focus-alert" role="status">{{ statusMessage }}</p>

    <template v-if="!timer">
      <fieldset class="focus-preset-fieldset">
        <legend>Timer preset</legend>
        <label>
          <input
            type="radio"
            name="focus-preset"
            value="25_5"
            :checked="preferences.preset === '25_5'"
            @change="patch('preset', '25_5')"
          >
          <span><strong>25 / 5</strong><small>25-minute focus, 5-minute break</small></span>
        </label>
        <label>
          <input
            type="radio"
            name="focus-preset"
            value="50_10"
            :checked="preferences.preset === '50_10'"
            @change="patch('preset', '50_10')"
          >
          <span><strong>50 / 10</strong><small>50-minute focus, 10-minute break</small></span>
        </label>
        <label>
          <input
            type="radio"
            name="focus-preset"
            value="CUSTOM"
            :checked="preferences.preset === 'CUSTOM'"
            @change="patch('preset', 'CUSTOM')"
          >
          <span><strong>Custom</strong><small>Choose your own durations</small></span>
        </label>
      </fieldset>

      <div v-if="preferences.preset === 'CUSTOM'" class="focus-duration-grid">
        <label for="focus-custom-minutes">
          Focus minutes
          <input
            id="focus-custom-minutes"
            type="number"
            min="1"
            max="240"
            step="1"
            inputmode="numeric"
            :value="preferences.customFocusMinutes"
            @input="patch('customFocusMinutes', Number($event.target.value))"
          >
        </label>
        <label for="focus-break-minutes">
          Break minutes
          <input
            id="focus-break-minutes"
            type="number"
            min="0"
            max="120"
            step="1"
            inputmode="numeric"
            :value="preferences.customBreakMinutes"
            @input="patch('customBreakMinutes', Number($event.target.value))"
          >
        </label>
      </div>

      <div class="focus-session-fields">
        <label for="focus-module">
          Module
          <select
            id="focus-module"
            :value="preferences.selectedModuleKey"
            :disabled="modulesLoading"
            @change="patch('selectedModuleKey', $event.target.value)"
          >
            <option v-for="module in modules" :key="module.key" :value="module.key">
              {{ module.code === 'GENERAL' ? module.title : `${module.code} · ${module.title}` }}
            </option>
          </select>
          <small v-if="modulesLoading">Loading your modules…</small>
          <small v-else-if="modulesError">Modules could not be loaded. General study is still available.</small>
        </label>

        <label for="focus-goal">
          Study goal <span>optional</span>
          <textarea
            id="focus-goal"
            rows="2"
            maxlength="240"
            placeholder="e.g. Complete tutorial questions 1–5"
            :value="preferences.goal"
            @input="patch('goal', $event.target.value)"
          />
        </label>
      </div>

      <div class="focus-preference-toggles">
        <label>
          <input
            type="checkbox"
            :checked="preferences.autoStartBreak"
            @change="patch('autoStartBreak', $event.target.checked)"
          >
          <span><strong>Start break automatically</strong><small>The next break begins as soon as focus ends.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="preferences.notificationsEnabled"
            @change="emit('toggle-notifications', $event.target.checked)"
          >
          <span>
            <strong>Browser notification</strong>
            <small>{{ notificationPermission === 'denied' ? 'Permission is denied in this browser.' : 'Requested only when you enable this setting.' }}</small>
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="preferences.soundEnabled"
            @change="emit('toggle-sound', $event.target.checked)"
          >
          <span><strong>Completion sound</strong><small>Off by default and enabled only after this action.</small></span>
        </label>
      </div>

      <button type="button" class="focus-button focus-button--primary focus-button--wide" @click="emit('start-focus')">
        <UIcon name="i-lucide-play" aria-hidden="true" />
        Start focus
      </button>
    </template>

    <template v-else>
      <div class="focus-active-context">
        <span>{{ selectedModuleLabel }}</span>
        <p v-if="timer.goal">{{ timer.goal }}</p>
        <p v-else>No study goal added.</p>
      </div>

      <div class="focus-clock" role="timer" aria-live="off" :aria-label="`${modeLabel} timer, ${clock(snapshot.remainingSeconds)} remaining`">
        {{ clock(snapshot.remainingSeconds) }}
      </div>

      <div
        class="focus-progress"
        role="progressbar"
        aria-label="Timer progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(snapshot.progress * 100)"
      >
        <span :style="{ width: `${Math.round(snapshot.progress * 100)}%` }" />
      </div>

      <p class="focus-clock-caption">
        {{ Math.floor(snapshot.elapsedSeconds / 60) }} focused minute{{ Math.floor(snapshot.elapsedSeconds / 60) === 1 ? '' : 's' }} elapsed
      </p>

      <div class="focus-controls" aria-label="Timer controls">
        <button
          v-if="timer.status === 'READY'"
          type="button"
          class="focus-button focus-button--primary"
          @click="emit('start-break')"
        >
          <UIcon name="i-lucide-play" aria-hidden="true" />
          Start break
        </button>
        <button
          v-else-if="timer.status === 'RUNNING'"
          type="button"
          class="focus-button focus-button--primary"
          @click="emit('pause')"
        >
          <UIcon name="i-lucide-pause" aria-hidden="true" />
          Pause
        </button>
        <button
          v-else
          type="button"
          class="focus-button focus-button--primary"
          @click="emit('resume')"
        >
          <UIcon name="i-lucide-play" aria-hidden="true" />
          Resume
        </button>

        <button
          v-if="isFocus"
          type="button"
          class="focus-button focus-button--secondary"
          :disabled="snapshot.elapsedSeconds < 1"
          @click="emit('finish-early')"
        >
          Finish early
        </button>
        <button
          v-else
          type="button"
          class="focus-button focus-button--secondary"
          @click="emit('skip-break')"
        >
          Skip break
        </button>

        <button type="button" class="focus-button focus-button--ghost" @click="emit('cancel')">
          Cancel
        </button>
        <button type="button" class="focus-button focus-button--ghost" @click="emit('reset')">
          Reset
        </button>
      </div>
    </template>
  </section>
</template>
