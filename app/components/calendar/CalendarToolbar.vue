<script setup>
defineProps({
  view: { type: String, required: true },
  monthLabel: { type: String, required: true },
  moduleId: { type: String, required: true },
  eventType: { type: String, required: true },
  modules: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

defineEmits([
  'update:view',
  'update:moduleId',
  'update:eventType',
  'previous',
  'next',
  'today',
  'refresh'
])
</script>

<template>
  <section class="calendar-toolbar" aria-label="Academic calendar controls">
    <div class="calendar-toolbar__navigation">
      <button type="button" class="calendar-icon-button" aria-label="Previous month" @click="$emit('previous')">
        <UIcon name="i-lucide-chevron-left" />
      </button>
      <button type="button" class="calendar-today-button" @click="$emit('today')">Today</button>
      <button type="button" class="calendar-icon-button" aria-label="Next month" @click="$emit('next')">
        <UIcon name="i-lucide-chevron-right" />
      </button>
      <h2 aria-live="polite">{{ monthLabel }}</h2>
    </div>

    <div class="calendar-toolbar__filters">
      <label>
        <span>Module</span>
        <select
          :value="moduleId"
          aria-label="Filter calendar by module"
          @change="$emit('update:moduleId', $event.target.value)"
        >
          <option value="ALL">All modules</option>
          <option v-for="module in modules" :key="module.moduleId" :value="module.moduleId">
            {{ module.moduleCode }} · {{ module.moduleTitle }}
          </option>
        </select>
      </label>

      <label>
        <span>Event type</span>
        <select
          :value="eventType"
          aria-label="Filter calendar by event type"
          @change="$emit('update:eventType', $event.target.value)"
        >
          <option value="ALL">All event types</option>
          <option value="ASSESSMENT">Assessments</option>
          <option value="EXAM">Examinations</option>
          <option value="CLASS">Class sessions</option>
        </select>
      </label>

      <div class="calendar-view-switch" aria-label="Calendar view">
        <button
          type="button"
          :aria-pressed="view === 'MONTH'"
          :class="{ 'is-active': view === 'MONTH' }"
          @click="$emit('update:view', 'MONTH')"
        >
          <UIcon name="i-lucide-calendar-days" />
          Month
        </button>
        <button
          type="button"
          :aria-pressed="view === 'AGENDA'"
          :class="{ 'is-active': view === 'AGENDA' }"
          @click="$emit('update:view', 'AGENDA')"
        >
          <UIcon name="i-lucide-list" />
          Agenda
        </button>
      </div>

      <button
        type="button"
        class="calendar-icon-button"
        :disabled="loading"
        aria-label="Refresh calendar data"
        @click="$emit('refresh')"
      >
        <UIcon name="i-lucide-refresh-cw" :class="{ 'calendar-spin': loading }" />
      </button>

      <slot name="export" />
    </div>
  </section>
</template>
