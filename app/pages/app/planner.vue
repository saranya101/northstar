<script setup>
import { localDateKey } from '~~/shared/planner/weekly-planner'

import '~/assets/css/planner.css'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Weekly Study Planner · Northstar', description: 'Plan browser-local study blocks around confirmed classes and assessments.' })

const {
  assessmentOptions,
  calendarDays,
  clearDraftErrors,
  error,
  fieldErrors,
  initialized,
  loading,
  localTimezone,
  modules,
  refresh,
  remove,
  save,
  selectWeek,
  selectedWeekEnd,
  selectedWeekOffset,
  selectedWeekStart,
  setStatus,
  summary,
  weekAssessments,
} = useWeeklyPlanner()
const route = useRoute()

const editorOpen = ref(false)
const editorMode = ref('create')
const selectedBlock = ref(null)
const defaultDate = ref('')
const conflicts = ref([])
const taskDraftOpened = ref(false)
const taskPrefill = computed(() => {
  const minutes = Math.min(240, Math.max(1, Number(route.query.estimatedMinutes) || 60))
  const end = 9 * 60 + minutes
  return { enrolmentId: String(route.query.moduleEnrolmentId || ''), title: String(route.query.title || '').slice(0, 160), goal: String(route.query.title || '').slice(0, 240), endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` }
})
const dateRange = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const assessmentDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function weekLabel() { return `${dateRange.format(selectedWeekStart.value)} – ${dateRange.format(selectedWeekEnd.value)}` }
function minutesLabel(minutes) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m` }
function openCreate(date = localDateKey(new Date())) { clearDraftErrors(); selectedBlock.value = null; editorMode.value = 'create'; defaultDate.value = date; conflicts.value = []; editorOpen.value = true }
function openEdit(block) { clearDraftErrors(); selectedBlock.value = block; editorMode.value = 'edit'; defaultDate.value = block.date; conflicts.value = []; editorOpen.value = true }
function openMove(block) { clearDraftErrors(); selectedBlock.value = block; editorMode.value = 'move'; defaultDate.value = block.date; conflicts.value = []; editorOpen.value = true }
function closeEditor() { editorOpen.value = false; selectedBlock.value = null; conflicts.value = [] }
function submit({ input, acknowledgeConflicts }) { const result = save(input, acknowledgeConflicts); conflicts.value = result.conflicts || []; if (result.ok) closeEditor() }
function confirmDelete(id) { if (window.confirm('Delete this local study block? This cannot be undone.')) { remove(id); closeEditor() } }
function typeLabel(value) { return String(value || 'Assessment').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
watch(initialized, ready => { if (ready && route.query.taskId && !taskDraftOpened.value) { taskDraftOpened.value = true; openCreate() } }, { immediate: true })
</script>

<template>
  <main class="app-page planner-page">
    <header class="app-page__header planner-header">
      <div><p class="app-page__eyebrow">Weekly planner</p><h1>Plan study around your real timetable</h1><span>Class sessions remain fixed. Your study blocks are private to this browser and account.</span></div>
      <div class="planner-header__actions"><span><UIcon name="i-lucide-clock-3" /> {{ localTimezone }}</span><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="refresh">Refresh</UButton><UButton icon="i-lucide-plus" @click="openCreate()">Add study block</UButton></div>
    </header>

    <div v-if="!initialized" class="planner-loading" aria-live="polite">Loading your local planner…</div>
    <p v-else-if="error" class="planner-alert" role="alert">{{ error }}</p>

    <template v-if="initialized">
      <section class="planner-week-nav" aria-label="Choose planner week">
        <button type="button" :class="{ active: selectedWeekOffset === -1 }" @click="selectWeek(-1)"><UIcon name="i-lucide-chevron-left" /> Previous week</button>
        <button type="button" :class="{ active: selectedWeekOffset === 0 }" @click="selectWeek(0)">Current week</button>
        <button type="button" :class="{ active: selectedWeekOffset === 1 }" @click="selectWeek(1)">Next week <UIcon name="i-lucide-chevron-right" /></button>
        <strong>{{ weekLabel() }}</strong>
      </section>

      <section class="planner-summary" aria-labelledby="planner-summary-title">
        <div class="planner-summary__heading"><p>Selected week</p><h2 id="planner-summary-title">Study guidance</h2></div>
        <dl>
          <div><dt>Planned study time</dt><dd>{{ minutesLabel(summary.plannedMinutes) }}</dd></div>
          <div><dt>Completed study time</dt><dd>{{ minutesLabel(summary.completedMinutes) }}</dd></div>
          <div><dt>Uncompleted blocks</dt><dd>{{ summary.uncompletedCount }}</dd></div>
        </dl>
        <div class="planner-module-totals">
          <strong>Study time by module</strong>
          <p v-if="!summary.byModule.length">No study time planned for this week.</p>
          <ul v-else><li v-for="item in summary.byModule" :key="item.key"><span>{{ item.code === 'GENERAL' ? 'General study' : item.code }}</span><strong>{{ minutesLabel(item.minutes) }}</strong><small>{{ minutesLabel(item.completedMinutes) }} completed</small></li></ul>
        </div>
      </section>

      <section class="planner-assessments" aria-labelledby="planner-assessments-title">
        <div><p class="app-page__eyebrow">Confirmed dates only</p><h2 id="planner-assessments-title">Assessments this week</h2></div>
        <p v-if="!weekAssessments.length">No assessments with persisted calendar dates fall within this week.</p>
        <template v-else>
          <NuxtLink v-for="assessment in weekAssessments" :key="assessment.id" :to="`/app/assessments/${assessment.id}`"><span><strong>{{ assessment.moduleCode }} · {{ assessment.name }}</strong><small>{{ typeLabel(assessment.type) }}<template v-if="assessment.weight !== null"> · {{ assessment.weight }}%</template></small></span><time :datetime="assessment.date">{{ assessmentDate.format(new Date(assessment.date)) }}</time><UIcon name="i-lucide-chevron-right" /></NuxtLink>
        </template>
      </section>

      <PlannerWeeklyCalendar :days="calendarDays" :today="localDateKey(new Date())" @add="openCreate" @edit="openEdit" @move="openMove" @delete="confirmDelete" @status="setStatus" />

      <PlannerStudyBlockModal v-model:open="editorOpen" :block="selectedBlock" :mode="editorMode" :default-date="defaultDate" :modules="modules" :assessments="assessmentOptions" :conflicts="conflicts" :field-errors="fieldErrors" :prefill="taskPrefill" @save="submit" @clear-conflicts="conflicts = []" @delete="confirmDelete" />
    </template>
  </main>
</template>
