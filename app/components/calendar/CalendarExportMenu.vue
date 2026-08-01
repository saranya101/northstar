<script setup>
import { CALENDAR_EVENT_CATEGORIES, filterCalendarEvents } from '#shared/calendar/events'

const props = defineProps({
  events: { type: Array, default: () => [] },
  selectedModuleId: { type: String, default: 'ALL' },
  modules: { type: Array, default: () => [] }
})

const emit = defineEmits(['export'])
const today = new Date()
const rangeStart = ref(new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10))
const rangeEndDate = new Date(today)
rangeEndDate.setDate(rangeEndDate.getDate() + 30)
const rangeEnd = ref(new Date(rangeEndDate.getTime() - rangeEndDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10))

const assessments = computed(() => props.events.filter(event => event.category === CALENDAR_EVENT_CATEGORIES.ASSESSMENT))
const exams = computed(() => props.events.filter(event => event.category === CALENDAR_EVENT_CATEGORIES.EXAM))
const selectedModuleEvents = computed(() => props.selectedModuleId === 'ALL'
  ? []
  : filterCalendarEvents(props.events, { moduleId: props.selectedModuleId }))
const timetableRange = computed(() => filterCalendarEvents(props.events, {
  eventType: CALENDAR_EVENT_CATEGORIES.CLASS,
  startDate: rangeStart.value,
  endDate: rangeEnd.value
}))

const selectedModule = computed(() => props.modules.find(module => module.moduleId === props.selectedModuleId))

function exportEvents(events, fileName, calendarName) {
  emit('export', { events, fileName, calendarName })
}
</script>

<template>
  <details class="calendar-export-menu">
    <summary>
      <UIcon name="i-lucide-download" />
      Export ICS
    </summary>

    <div class="calendar-export-menu__panel">
      <div>
        <h3>Confirmed records</h3>
        <button
          type="button"
          :disabled="!assessments.length"
          @click="exportEvents(assessments, 'northstar-confirmed-assessments', 'Northstar Confirmed Assessments')"
        >
          <span>All confirmed assessments</span>
          <small>{{ assessments.length }} event{{ assessments.length === 1 ? '' : 's' }}</small>
        </button>
        <button
          type="button"
          :disabled="!exams.length"
          @click="exportEvents(exams, 'northstar-confirmed-exams', 'Northstar Confirmed Examinations')"
        >
          <span>All confirmed exams</span>
          <small>{{ exams.length }} event{{ exams.length === 1 ? '' : 's' }}</small>
        </button>
        <button
          type="button"
          :disabled="selectedModuleId === 'ALL' || !selectedModuleEvents.length"
          @click="exportEvents(
            selectedModuleEvents,
            `northstar-${selectedModule?.moduleCode || 'module'}`,
            `Northstar · ${selectedModule?.moduleCode || 'Selected module'}`
          )"
        >
          <span>Selected module</span>
          <small>{{ selectedModuleId === 'ALL' ? 'Choose a module first' : `${selectedModuleEvents.length} events` }}</small>
        </button>
      </div>

      <div class="calendar-export-range">
        <h3>Timetable date range</h3>
        <label>
          <span>From</span>
          <input v-model="rangeStart" type="date">
        </label>
        <label>
          <span>To</span>
          <input v-model="rangeEnd" type="date" :min="rangeStart">
        </label>
        <button
          type="button"
          :disabled="!rangeStart || !rangeEnd || rangeEnd < rangeStart || !timetableRange.length"
          @click="exportEvents(
            timetableRange,
            `northstar-timetable-${rangeStart}-${rangeEnd}`,
            'Northstar Timetable Sessions'
          )"
        >
          <span>Export timetable sessions</span>
          <small>{{ timetableRange.length }} event{{ timetableRange.length === 1 ? '' : 's' }}</small>
        </button>
      </div>
    </div>
  </details>
</template>
