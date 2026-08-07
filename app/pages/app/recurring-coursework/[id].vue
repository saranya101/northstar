<script setup>
import { normalizeRecessWeeksInput, RECURRING_COURSEWORK_FREQUENCIES, RECURRING_COURSEWORK_TYPES } from '#shared/schemas/recurring-coursework'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
const route = useRoute()
const { details, loading, saving, error, loadOne, update, generate, updateOccurrence, verifyOccurrence } = useRecurringCoursework()
const { tasks: linkedTasks, load: loadTasks } = useTasks()
const { records: assessmentRecords, load: loadAssessments } = useAssessments()
const requirement = computed(() => details.value[route.params.id])
const edit = reactive({ title: '', type: 'LAMS', description: '', frequency: 'WEEKLY', totalExpected: 1, firstTeachingWeek: null, lastTeachingWeek: null, graded: false, totalAssessmentWeight: null, completeBeforeClass: false, timingNote: '', assessmentId: null, includeRecessWeeks: false, status: 'ACTIVE', removeIncompleteOccurrences: false })
const editRecessWeeks = ref('')
const verification = reactive({})
const occurrenceEdits = reactive({})
const statusItems = ['ACTIVE', 'COMPLETED', 'ARCHIVED'].map(value => ({ label: value.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()), value }))

useSeoMeta({ title: () => requirement.value ? `${requirement.value.title} · Coursework tracker` : 'Coursework tracker · Northstar' })
watch(requirement, value => {
  if (!value) return
  Object.assign(edit, { title: value.title, type: value.type, description: value.description || '', frequency: value.frequency, totalExpected: value.totalExpected, firstTeachingWeek: value.firstTeachingWeek, lastTeachingWeek: value.lastTeachingWeek, graded: value.graded, totalAssessmentWeight: value.totalAssessmentWeight, completeBeforeClass: value.completeBeforeClass, timingNote: value.timingNote || '', assessmentId: value.assessmentId, includeRecessWeeks: value.includeRecessWeeks, status: value.status, removeIncompleteOccurrences: false })
  editRecessWeeks.value = value.recessWeeks.join(', ')
  void loadAssessments(value.userModuleEnrolmentId)
  void loadTasks({ recurringCourseworkId: value.id, view: 'ALL' })
  for (const item of value.occurrences) verification[item.id] = {
    workCompleted: item.workCompleted, finalConfirmationClicked: item.finalConfirmationClicked, gradeCentreChecked: item.gradeCentreChecked,
    markCaptured: item.markCaptured, submissionReference: item.submissionReference || '', score: item.score, maximumScore: item.maximumScore
  }
  for (const item of value.occurrences) occurrenceEdits[item.id] = { officialDueAt: item.officialDueAt ? new Date(item.officialDueAt).toISOString().slice(0, 16) : '', timingNote: item.timingNote || '', privateNotes: item.privateNotes || '' }
}, { immediate: true })
onMounted(() => void loadOne(route.params.id))

const label = value => value === 'LAMS' ? 'LAMS' : value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const typeItems = RECURRING_COURSEWORK_TYPES.map(value => ({ label: label(value), value }))
const frequencyItems = RECURRING_COURSEWORK_FREQUENCIES.map(value => ({ label: label(value), value }))
const assessments = computed(() => assessmentRecords.value[requirement.value?.userModuleEnrolmentId]?.assessments || [])
const assessmentItems = computed(() => [{ label: 'No related assessment', value: null }, ...assessments.value.map(item => ({ label: `${item.name} (${item.weight ?? 'TBA'}%)`, value: item.id }))])
const formatDate = value => value ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No official deadline'
const taskForOccurrence = id => linkedTasks.value.find(task => task.recurringCourseworkOccurrenceId === id)
const occurrenceTaskRoute = item => ({ path: '/app/tasks', query: { create: '1', title: `${requirement.value.title} ${item.teachingWeek ? `Week ${item.teachingWeek}` : `Occurrence ${item.sequenceNumber}`}`, moduleEnrolmentId: requirement.value.userModuleEnrolmentId, assessmentId: requirement.value.assessmentId, recurringCourseworkId: requirement.value.id, recurringCourseworkOccurrenceId: item.id, timingNote: item.timingNote || requirement.value.timingNote, dueAt: item.officialDueAt } })
async function saveRequirement() {
  const recessWeeks = normalizeRecessWeeksInput(editRecessWeeks.value)
  await update(requirement.value.id, { expectedUpdatedAt: requirement.value.updatedAt, ...edit, description: edit.description || null, timingNote: edit.timingNote || null, assessmentId: edit.assessmentId || null, totalAssessmentWeight: edit.graded ? edit.totalAssessmentWeight : null, recessWeeks })
}
async function setStatus(item, status) { await updateOccurrence(requirement.value.id, item.id, { expectedUpdatedAt: item.updatedAt, status }) }
async function saveOccurrence(item) {
  const value = occurrenceEdits[item.id]
  await updateOccurrence(requirement.value.id, item.id, { expectedUpdatedAt: item.updatedAt, officialDueAt: value.officialDueAt ? new Date(value.officialDueAt).toISOString() : null, timingNote: value.timingNote || null, privateNotes: value.privateNotes || null })
}
async function saveVerification(item) {
  const value = verification[item.id]
  await verifyOccurrence(requirement.value.id, item.id, { expectedUpdatedAt: item.updatedAt, ...value, submissionReference: value.submissionReference || null, score: value.score === '' ? null : value.score, maximumScore: value.maximumScore === '' ? null : value.maximumScore })
}
</script>

<template>
  <main class="app-page recurring-tracker">
    <p v-if="loading && !requirement" role="status">Loading coursework tracker…</p>
    <p v-else-if="!requirement" class="module-alert" role="alert">{{ error || 'Coursework tracker unavailable.' }}</p>
    <template v-else>
      <NuxtLink :to="`/app/modules/${requirement.userModuleEnrolmentId}#coursework`" class="dossier-back"><UIcon name="i-lucide-arrow-left" /> Back to module coursework</NuxtLink>
      <header class="review-header"><div><p>{{ label(requirement.type) }}</p><h1>{{ requirement.title }}</h1><span>{{ requirement.progress.completedCount }} of {{ requirement.totalExpected }} completed · {{ requirement.progress.completionPercentage }}%</span></div><UBadge color="neutral" variant="outline">{{ label(requirement.status) }}</UBadge></header>
      <div v-if="requirement.progress.unverifiedSubmissionCount" class="module-alert tracker-warning" role="alert"><UIcon name="i-lucide-triangle-alert" /><span>{{ requirement.progress.unverifiedSubmissionCount }} submitted occurrence(s) need final confirmation. Northstar has not checked NTULearn.</span></div>

      <section class="tracker-summary dossier-section">
        <div><strong>{{ requirement.progress.completedCount }}</strong><span>Completed</span></div><div><strong>{{ requirement.progress.remainingCount }}</strong><span>Remaining</span></div><div><strong>{{ requirement.progress.submittedCount }}</strong><span>Submitted</span></div><div><strong>{{ requirement.progress.verifiedCount }}</strong><span>Verified</span></div><div><strong>{{ requirement.progress.missedCount }}</strong><span>Missed</span></div>
      </section>

      <section class="dossier-section occurrence-section">
        <div class="dossier-section__heading"><div><p>Expected work</p><h2>Occurrences</h2></div><UButton color="neutral" variant="outline" :loading="saving" @click="generate(requirement.id, requirement.updatedAt)">Generate missing occurrences</UButton></div>
        <article v-for="item in requirement.occurrences" :key="item.id" class="occurrence-card">
          <div class="occurrence-heading"><div><strong>{{ item.teachingWeek ? `Week ${item.teachingWeek}` : `Occurrence ${item.sequenceNumber}` }}</strong><span>{{ item.timingNote || requirement.timingNote || (requirement.completeBeforeClass ? 'Before class' : formatDate(item.officialDueAt)) }}</span></div><UBadge :color="item.status === 'VERIFIED' ? 'success' : item.status === 'MISSED' ? 'error' : 'neutral'">{{ label(item.status) }}</UBadge></div>
          <p v-if="item.unverifiedSubmission" class="tracker-warning"><UIcon name="i-lucide-triangle-alert" /> {{ item.finalConfirmationClicked ? 'Final confirmation recorded; Grade Centre verification is still outstanding.' : 'Submitted, but final confirmation has not been verified.' }}</p>
          <div class="occurrence-actions"><UButton :to="taskForOccurrence(item.id) ? '/app/tasks?view=ALL' : occurrenceTaskRoute(item)" size="sm" color="neutral" variant="outline">{{ taskForOccurrence(item.id) ? 'Open task' : 'Create task' }}</UButton><UButton size="sm" color="neutral" variant="outline" @click="setStatus(item, 'IN_PROGRESS')">Mark started</UButton><UButton size="sm" @click="setStatus(item, 'SUBMITTED')">Mark completed/submitted</UButton><UButton size="sm" color="neutral" variant="ghost" @click="setStatus(item, 'MISSED')">Mark missed</UButton><UButton size="sm" color="neutral" variant="ghost" @click="setStatus(item, 'EXCUSED')">Mark excused</UButton></div>
          <details><summary>Deadline, timing and private notes</summary><form class="verification-form" @submit.prevent="saveOccurrence(item)">
            <div class="module-field"><label :for="`due-${item.id}`">Official due date and time <em>optional</em></label><input :id="`due-${item.id}`" v-model="occurrenceEdits[item.id].officialDueAt" type="datetime-local"></div>
            <div class="module-field"><label :for="`timing-${item.id}`">Timing note <em>optional</em></label><UInput :id="`timing-${item.id}`" v-model="occurrenceEdits[item.id].timingNote" maxlength="500" placeholder="Before seminar" /></div>
            <div class="module-field"><label :for="`notes-${item.id}`">Private notes <em>optional</em></label><UTextarea :id="`notes-${item.id}`" v-model="occurrenceEdits[item.id].privateNotes" :rows="3" maxlength="5000" /></div>
            <UButton type="submit" size="sm" color="neutral" variant="outline" :loading="saving">Save occurrence details</UButton>
          </form></details>
          <details><summary>Submission verification and mark</summary><form class="verification-form" @submit.prevent="saveVerification(item)">
            <label><input v-model="verification[item.id].workCompleted" type="checkbox"> Work completed</label>
            <label><input v-model="verification[item.id].finalConfirmationClicked" type="checkbox"> Final confirmation clicked</label>
            <label><input v-model="verification[item.id].gradeCentreChecked" type="checkbox"> Grade Centre checked manually</label>
            <label><input v-model="verification[item.id].markCaptured" type="checkbox"> Mark captured</label>
            <div class="module-form__grid"><div class="module-field"><label :for="`score-${item.id}`">Score</label><UInput :id="`score-${item.id}`" v-model.number="verification[item.id].score" type="number" min="0" step=".01" /></div><div class="module-field"><label :for="`maximum-${item.id}`">Maximum score</label><UInput :id="`maximum-${item.id}`" v-model.number="verification[item.id].maximumScore" type="number" min=".01" step=".01" /></div></div>
            <div class="module-field"><label :for="`reference-${item.id}`">Submission reference <em>optional</em></label><UInput :id="`reference-${item.id}`" v-model="verification[item.id].submissionReference" maxlength="255" /></div>
            <UButton type="submit" size="sm" :loading="saving">Save verification</UButton>
          </form></details>
        </article>
      </section>

      <section id="edit" class="dossier-section"><div class="dossier-section__heading"><div><p>Definition</p><h2>Edit requirement</h2></div></div><form class="module-form" @submit.prevent="saveRequirement">
        <div class="module-field"><label for="edit-recurring-title">Title</label><UInput id="edit-recurring-title" v-model="edit.title" required maxlength="200" /></div>
        <div class="module-form__grid"><div class="module-field"><label for="edit-recurring-type">Type</label><USelect id="edit-recurring-type" v-model="edit.type" :items="typeItems" value-key="value" label-key="label" /></div><div class="module-field"><label for="edit-recurring-frequency">Frequency</label><USelect id="edit-recurring-frequency" v-model="edit.frequency" :items="frequencyItems" value-key="value" label-key="label" /></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="edit-recurring-total">Total expected</label><UInput id="edit-recurring-total" v-model.number="edit.totalExpected" type="number" min="1" max="100" /></div><div class="module-field"><label for="edit-recurring-status">Status</label><USelect id="edit-recurring-status" v-model="edit.status" :items="statusItems" value-key="value" label-key="label" /></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="edit-first-week">First teaching week</label><UInput id="edit-first-week" v-model.number="edit.firstTeachingWeek" type="number" min="1" max="60" /></div><div class="module-field"><label for="edit-last-week">Last teaching week</label><UInput id="edit-last-week" v-model.number="edit.lastTeachingWeek" type="number" min="1" max="60" /></div></div>
        <div class="module-field"><label for="edit-recess-weeks">Recess weeks <em>optional, comma separated</em></label><UInput id="edit-recess-weeks" v-model="editRecessWeeks" placeholder="7" /><label class="remove-confirm"><input v-model="edit.includeRecessWeeks" type="checkbox"> Explicitly include declared recess weeks</label></div>
        <label class="remove-confirm"><input v-model="edit.removeIncompleteOccurrences" type="checkbox"> Explicitly remove generated, incomplete occurrences above the new count. Completed, submitted, verified, missed and excused records are always retained.</label>
        <div class="module-form__grid"><label class="remove-confirm"><input v-model="edit.graded" type="checkbox"> Graded requirement</label><div v-if="edit.graded" class="module-field"><label for="edit-recurring-weight">Known total weight % <em>optional</em></label><UInput id="edit-recurring-weight" v-model.number="edit.totalAssessmentWeight" type="number" min="0" max="100" step=".1" /></div></div>
        <div class="module-field"><label for="edit-recurring-assessment">Related assessment <em>optional</em></label><USelect id="edit-recurring-assessment" v-model="edit.assessmentId" :items="assessmentItems" value-key="value" label-key="label" /></div>
        <label class="remove-confirm"><input v-model="edit.completeBeforeClass" type="checkbox"> Complete before class</label>
        <div class="module-field"><label for="edit-recurring-timing">Timing note <em>optional</em></label><UInput id="edit-recurring-timing" v-model="edit.timingNote" maxlength="500" placeholder="Before seminar · Tuesday, 7:00 PM" /></div>
        <div class="module-field"><label for="edit-recurring-description">Description</label><UTextarea id="edit-recurring-description" v-model="edit.description" :rows="4" maxlength="5000" /></div>
        <UButton type="submit" :loading="saving">Save requirement</UButton>
      </form></section>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    </template>
  </main>
</template>

<style scoped>
.recurring-tracker { max-width:1100px; }.tracker-warning { display:flex; gap:.45rem; color:#765617; }.module-alert.tracker-warning { margin-top:1rem; }
.tracker-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; padding:1px; background:var(--ns-border); }.tracker-summary div { display:grid; gap:.2rem; padding:1rem; background:#f8f6ef; }.tracker-summary strong { font-size:1.35rem; }.tracker-summary span { color:var(--ns-text-muted); font-size:.75rem; }
.occurrence-section { display:grid; gap:.8rem; }.occurrence-card { display:grid; gap:.8rem; border:1px solid var(--ns-border); border-radius:.8rem; padding:1rem; background:white; }.occurrence-heading { display:flex; justify-content:space-between; gap:.7rem; }.occurrence-heading > div { display:grid; gap:.2rem; }.occurrence-heading span { color:var(--ns-text-muted); font-size:.75rem; }
.occurrence-actions { display:flex; flex-wrap:wrap; gap:.45rem; }.occurrence-card summary { cursor:pointer; color:var(--ns-accent); font-size:.82rem; font-weight:650; }.verification-form { display:grid; gap:.7rem; margin-top:.8rem; border-top:1px solid var(--ns-border); padding-top:.8rem; }.verification-form > label,.remove-confirm { display:flex; gap:.5rem; align-items:flex-start; font-size:.82rem; }
@media (max-width:700px) { .tracker-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }.occurrence-heading { flex-direction:column; }.occurrence-actions { display:grid; grid-template-columns:1fr; }.occurrence-actions button { width:100%; justify-content:center; } }
</style>
