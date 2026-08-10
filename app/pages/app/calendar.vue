<script setup>
import '~/assets/css/academic-calendar.css'
import '~/assets/css/calendar-v2.css'
import {
  CALENDAR_EVENT_CATEGORIES,
  buildMonthGrid,
  dateKey,
  filterCalendarEvents,
  firstDayOfMonth,
  groupCalendarEventsByDate,
  lastDayOfMonth,
  shiftMonth
} from '#shared/calendar/events'
import { downloadAcademicCalendar } from '~/utils/calendar-download.client'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({
  title: 'Academic calendar · Northstar',
  description: 'Confirmed academic dates and recurring timetable sessions.'
})

const { data, error, loading, refresh } = useAcademicCalendar()
const view = ref('MONTH')
const selectedModuleId = ref('ALL')
const selectedEventType = ref('ALL')
const selectedEvent = ref(null)
const detailOpen = ref(false)

const today = dateKey(new Date())
const currentMonth = ref(firstDayOfMonth(today))

const monthLabel = computed(() => new Intl.DateTimeFormat('en-SG', {
  month: 'long',
  year: 'numeric'
}).format(new Date(`${currentMonth.value}T00:00:00`)))

const filteredEvents = computed(() => filterCalendarEvents(data.value.events, {
  moduleId: selectedModuleId.value,
  eventType: selectedEventType.value
}))

const monthEvents = computed(() => filterCalendarEvents(filteredEvents.value, {
  startDate: currentMonth.value,
  endDate: lastDayOfMonth(currentMonth.value)
}))

const monthDays = computed(() => buildMonthGrid(currentMonth.value, monthEvents.value, today))
const agendaGroups = computed(() => groupCalendarEventsByDate(monthEvents.value))

const filteredUnresolved = computed(() => data.value.unresolved.filter(item => {
  if (selectedModuleId.value !== 'ALL' && item.moduleId !== selectedModuleId.value) return false
  if (selectedEventType.value !== 'ALL' && item.category !== selectedEventType.value) return false
  return true
}))

const monthAssessmentCount = computed(() => monthEvents.value.filter(event => event.category === CALENDAR_EVENT_CATEGORIES.ASSESSMENT).length)
const monthExamCount = computed(() => monthEvents.value.filter(event => event.category === CALENDAR_EVENT_CATEGORIES.EXAM).length)
const monthClassCount = computed(() => monthEvents.value.filter(event => event.category === CALENDAR_EVENT_CATEGORIES.CLASS).length)
const hasCourseworkDates = computed(() => data.value.events.some(event => event.category === CALENDAR_EVENT_CATEGORIES.ASSESSMENT))
const hasExamDates = computed(() => data.value.events.some(event => event.category === CALENDAR_EVENT_CATEGORIES.EXAM))
const hasClassDates = computed(() => data.value.events.some(event => event.category === CALENDAR_EVENT_CATEGORIES.CLASS))

function previousMonth() {
  currentMonth.value = shiftMonth(currentMonth.value, -1)
}

function nextMonth() {
  currentMonth.value = shiftMonth(currentMonth.value, 1)
}

function goToday() {
  currentMonth.value = firstDayOfMonth(today)
}

function openEvent(event) {
  selectedEvent.value = event
  detailOpen.value = true
}

function exportSelection({ events, fileName, calendarName }) {
  downloadAcademicCalendar(events, { fileName, calendarName })
}

function exportOne(event) {
  if (!event) return
  downloadAcademicCalendar([event], {
    fileName: `northstar-${event.moduleCode}-${event.title}`,
    calendarName: `Northstar · ${event.title}`
  })
}

function unresolvedTiming(item) {
  return item.timingReference ? `Reference: ${item.timingReference}` : item.reason
}
</script>

<template>
  <main class="app-page v2-page academic-calendar-page">
    <header class="v2-page-heading">
      <div>
        <p>{{ data.activeSemester?.label || 'Active semester' }}</p>
        <h1>Calendar and agenda</h1>
      </div>
    </header>

    <p v-if="error" class="module-alert" role="alert">
      <UIcon name="i-lucide-triangle-alert" />
      {{ error }}
      Calendar data that loaded successfully is still shown below.
    </p>

    <CalendarToolbar
      v-model:view="view"
      v-model:module-id="selectedModuleId"
      v-model:event-type="selectedEventType"
      :month-label="monthLabel"
      :modules="data.modules"
      :loading="loading"
      @previous="previousMonth"
      @next="nextMonth"
      @today="goToday"
      @refresh="refresh"
    >
      <template #export>
        <CalendarExportMenu
          :events="data.events"
          :selected-module-id="selectedModuleId"
          :modules="data.modules"
          @export="exportSelection"
        />
      </template>
    </CalendarToolbar>

    <p v-if="loading && !data.events.length" class="calendar-loading" role="status">
      <UIcon name="i-lucide-loader-circle" class="calendar-spin" />
      Loading confirmed academic dates…
    </p>

    <template v-else>
      <dl class="v2-inline-stats calendar-summary" aria-label="Selected month summary">
        <div><dt>Assessments</dt><dd>{{ monthAssessmentCount }}</dd></div>
        <div><dt>Examinations</dt><dd>{{ monthExamCount }}</dd></div>
        <div><dt>Class sessions</dt><dd>{{ monthClassCount }}</dd></div>
        <div><dt>Awaiting dates</dt><dd>{{ filteredUnresolved.length }}</dd></div>
      </dl>

      <p v-if="hasExamDates && !hasCourseworkDates" class="calendar-context-note">
        Exams are confirmed; no coursework dates have been recorded yet.
      </p>
      <p v-else-if="hasClassDates && !hasCourseworkDates && !hasExamDates" class="calendar-context-note">
        Timetable sessions are available, but no confirmed assessment dates have been recorded.
      </p>
      <p
        v-if="data.timetableSessionCount && !data.timetableMapped"
        class="calendar-context-note"
      >
        Timetable sessions could not be mapped because the semester date range is incomplete.
      </p>

      <section
        v-if="!data.events.length && !filteredUnresolved.length"
        class="module-empty calendar-empty"
      >
        <span class="module-empty__icon"><UIcon name="i-lucide-calendar-x" /></span>
        <p>No confirmed calendar dates</p>
        <h2>Your academic calendar is ready for real dates</h2>
        <span>
          Confirm assessment dates or import a timetable. Week-based references remain separate until an official date exists.
        </span>
      </section>

      <template v-else>
        <section v-if="!monthEvents.length" class="calendar-month-empty">
          <UIcon name="i-lucide-calendar-search" />
          <div>
            <h2>No events in selected month</h2>
            <p>Try another month or adjust the module and event-type filters.</p>
          </div>
        </section>

        <div v-else-if="view === 'MONTH'" class="calendar-v2-layout">
          <CalendarMonth :days="monthDays" @select-event="openEvent" />
          <aside class="v2-panel calendar-v2-agenda" aria-label="Month agenda">
            <div class="v2-section-heading"><div><p>Selected month</p><h2>Agenda</h2></div><span>{{ monthEvents.length }} events</span></div>
            <CalendarAgenda v-if="agendaGroups.length" :groups="agendaGroups" @select-event="openEvent" />
            <div v-else class="v2-empty"><strong>No dated events.</strong><span>Try another month or adjust the filters.</span></div>
          </aside>
        </div>

        <CalendarAgenda
          v-else
          :groups="agendaGroups"
          @select-event="openEvent"
        />
      </template>

      <section
        v-if="filteredUnresolved.length"
        class="calendar-awaiting"
        aria-labelledby="awaiting-date-title"
      >
        <header>
          <div>
            <p>Date safety</p>
            <h2 id="awaiting-date-title">Awaiting official date</h2>
          </div>
          <span>{{ filteredUnresolved.length }} unresolved</span>
        </header>

        <p>
          These records are intentionally excluded from the month view and ICS exports. Week numbers and prose timing are not converted into dates.
        </p>

        <ul>
          <li v-for="item in filteredUnresolved" :key="item.id">
            <div>
              <span>{{ item.moduleCode }} · {{ item.reason }}</span>
              <h3>{{ item.name }}</h3>
              <p>
                <template v-if="item.weight !== null">{{ item.weight }}% · </template>
                {{ unresolvedTiming(item) }}
              </p>
              <small>{{ item.sourceLabel }}</small>
            </div>
            <UButton color="neutral" variant="outline" size="sm" :to="item.link">
              Open assessment
            </UButton>
          </li>
        </ul>
      </section>
    </template>

    <CalendarEventDetails
      v-model:open="detailOpen"
      :event="selectedEvent"
      @export="exportOne"
    />
  </main>
</template>
