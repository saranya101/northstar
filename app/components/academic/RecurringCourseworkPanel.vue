<script setup>
import { normalizeOptionalNumber, normalizeRecessWeeksInput, RECURRING_COURSEWORK_FREQUENCIES, RECURRING_COURSEWORK_TYPES } from '#shared/schemas/recurring-coursework'

const props = defineProps({ enrolmentId: { type: String, required: true } })
const { records, loading, saving, error, fieldErrors, load, create, archive, generate } = useRecurringCoursework()
const { records: assessmentRecords, load: loadAssessments } = useAssessments()
const open = ref(false)
const recessText = ref('')
const form = reactive({ title: '', type: 'LAMS', description: '', frequency: 'WEEKLY', totalExpected: 13, firstTeachingWeek: 1, lastTeachingWeek: 13, graded: false, totalAssessmentWeight: null, completeBeforeClass: false, timingNote: '', assessmentId: null, includeRecessWeeks: false })
const list = computed(() => records.value[props.enrolmentId] || [])
const assessments = computed(() => assessmentRecords.value[props.enrolmentId]?.assessments || [])
const summary = computed(() => list.value.reduce((result, item) => ({
  active: result.active + Number(item.status === 'ACTIVE'), completed: result.completed + item.progress.completedCount,
  remaining: result.remaining + item.progress.remainingCount, unverified: result.unverified + item.progress.unverifiedSubmissionCount,
  missed: result.missed + item.progress.missedCount
}), { active: 0, completed: 0, remaining: 0, unverified: 0, missed: 0 }))

onMounted(() => { void load(props.enrolmentId); void loadAssessments(props.enrolmentId) })
const label = value => value === 'LAMS' ? 'LAMS' : value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const typeItems = RECURRING_COURSEWORK_TYPES.map(value => ({ label: label(value), value }))
const frequencyItems = RECURRING_COURSEWORK_FREQUENCIES.map(value => ({ label: label(value), value }))
const formatDate = value => value ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No known deadline'
const assessmentItems = computed(() => [{ label: 'No related assessment', value: null }, ...assessments.value.map(item => ({ label: `${item.name} (${item.weight ?? 'TBA'}%)`, value: item.id }))])
function reset() { Object.assign(form, { title: '', type: 'LAMS', description: '', frequency: 'WEEKLY', totalExpected: 13, firstTeachingWeek: 1, lastTeachingWeek: 13, graded: false, totalAssessmentWeight: null, completeBeforeClass: false, timingNote: '', assessmentId: null, includeRecessWeeks: false }); recessText.value = '' }
async function add() {
  const result = await create(props.enrolmentId, {
    ...form,
    totalExpected: normalizeOptionalNumber(form.totalExpected),
    firstTeachingWeek: normalizeOptionalNumber(form.firstTeachingWeek),
    lastTeachingWeek: normalizeOptionalNumber(form.lastTeachingWeek),
    description: form.description || null,
    timingNote: form.timingNote || null,
    assessmentId: form.assessmentId || null,
    totalAssessmentWeight: form.graded ? normalizeOptionalNumber(form.totalAssessmentWeight) : undefined,
    recessWeeks: normalizeRecessWeeksInput(recessText.value)
  })
  if (result) { open.value = false; reset() }
}
</script>

<template>
  <section id="coursework" class="dossier-section coursework-panel" aria-labelledby="coursework-title">
    <div class="dossier-section__heading"><div><p>Repeated academic requirements</p><h2 id="coursework-title">Coursework</h2></div><UButton icon="i-lucide-plus" @click="open = true">Create recurring requirement</UButton></div>
    <div class="coursework-summary">
      <div><strong>{{ summary.active }}</strong><span>Active requirements</span></div><div><strong>{{ summary.completed }}</strong><span>Completed occurrences</span></div><div><strong>{{ summary.remaining }}</strong><span>Remaining occurrences</span></div><div><strong>{{ summary.unverified }}</strong><span>Unverified submissions</span></div><div><strong>{{ summary.missed }}</strong><span>Missed occurrences</span></div>
    </div>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Loading recurring coursework…</p>
    <div v-else-if="list.length" class="coursework-list">
      <article v-for="item in list" :key="item.id" :class="{ archived: item.status === 'ARCHIVED' }">
        <div class="coursework-heading"><div><strong>{{ item.title }}</strong><span>{{ label(item.type) }} · {{ item.graded ? 'Graded' : 'Ungraded' }}</span></div><UBadge color="neutral" variant="outline">{{ label(item.status) }}</UBadge></div>
        <div class="coursework-progress"><span :style="{ width: `${item.progress.completionPercentage}%` }" /></div>
        <p>{{ item.progress.completedCount }} of {{ item.totalExpected }} completed · {{ item.progress.remainingCount }} remaining</p>
        <p v-if="item.progress.nextIncomplete"><strong>Next:</strong> {{ item.progress.nextIncomplete.teachingWeek ? `Week ${item.progress.nextIncomplete.teachingWeek}` : `Occurrence ${item.progress.nextIncomplete.sequenceNumber}` }} · {{ formatDate(item.progress.nextKnownDeadline?.officialDueAt) }}</p>
        <p v-if="item.progress.unverifiedSubmissionCount" class="coursework-warning"><UIcon name="i-lucide-triangle-alert" /> {{ item.progress.unverifiedSubmissionCount }} submitted item(s) still need submission verification. Northstar has not checked NTULearn.</p>
        <p v-if="item.assessment"><strong>Related assessment:</strong> {{ item.assessment.name }} · {{ item.assessment.weight ?? item.totalAssessmentWeight ?? 'TBA' }}%</p>
        <div class="academic-actions"><UButton :to="`/app/recurring-coursework/${item.id}`" color="neutral" variant="outline">Open tracker</UButton><UButton :to="`/app/recurring-coursework/${item.id}#edit`" color="neutral" variant="ghost">Edit</UButton><UButton v-if="item.status !== 'ARCHIVED'" color="neutral" variant="ghost" @click="generate(item.id, item.updatedAt)">Generate missing occurrences</UButton><UButton v-if="item.status !== 'ARCHIVED'" color="neutral" variant="ghost" @click="archive(props.enrolmentId, item.id)">Archive</UButton></div>
      </article>
    </div>
    <p v-else class="dossier-empty">No recurring coursework has been defined for this module.</p>

    <UModal v-model:open="open" title="Create recurring coursework" description="Define one academic requirement and generate its expected occurrences.">
      <template #body><form id="recurring-coursework-form" class="module-form" @submit.prevent="add">
        <div class="module-field"><label for="recurring-title">Title</label><UInput id="recurring-title" v-model="form.title" required maxlength="200" /><small>{{ fieldErrors.title }}</small></div>
        <div class="module-form__grid"><div class="module-field"><label for="recurring-type">Type</label><USelect id="recurring-type" v-model="form.type" :items="typeItems" value-key="value" label-key="label" /></div><div class="module-field"><label for="recurring-frequency">Frequency</label><USelect id="recurring-frequency" v-model="form.frequency" :items="frequencyItems" value-key="value" label-key="label" /></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="recurring-total">Total expected</label><UInput id="recurring-total" v-model.number="form.totalExpected" type="number" min="1" max="100" /><small>{{ fieldErrors.totalExpected }}</small></div><div class="module-field"><label for="recurring-assessment">Related assessment <em>optional</em></label><USelect id="recurring-assessment" v-model="form.assessmentId" :items="assessmentItems" value-key="value" label-key="label" /><small>{{ fieldErrors.assessmentId }}</small></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="recurring-first-week">First teaching week</label><UInput id="recurring-first-week" v-model.number="form.firstTeachingWeek" type="number" min="1" max="60" /><small>{{ fieldErrors.firstTeachingWeek }}</small></div><div class="module-field"><label for="recurring-last-week">Last teaching week</label><UInput id="recurring-last-week" v-model.number="form.lastTeachingWeek" type="number" min="1" max="60" /><small>{{ fieldErrors.lastTeachingWeek }}</small></div></div>
        <div class="module-field"><label for="recurring-recess">Recess weeks <em>optional, comma separated</em></label><UInput id="recurring-recess" v-model="recessText" placeholder="7" /><small>{{ fieldErrors.recessWeeks }}</small><label class="coursework-check"><input v-model="form.includeRecessWeeks" type="checkbox"> Explicitly include declared recess weeks</label></div>
        <div class="module-form__grid"><label class="coursework-check"><input v-model="form.graded" type="checkbox"> Graded requirement</label><div v-if="form.graded" class="module-field"><label for="recurring-weight">Total assessment weight % <em>optional</em></label><UInput id="recurring-weight" v-model.number="form.totalAssessmentWeight" type="number" min="0" max="100" step=".1" /><small>{{ fieldErrors.totalAssessmentWeight || 'Missing weight remains TBA.' }}</small></div></div>
        <label class="coursework-check"><input v-model="form.completeBeforeClass" type="checkbox"> Complete before class</label>
        <div class="module-field"><label for="recurring-timing">Timing note <em>optional</em></label><UInput id="recurring-timing" v-model="form.timingNote" maxlength="500" placeholder="Before seminar · Tuesday, 7:00 PM" /></div>
        <div class="module-field"><label for="recurring-description">Description <em>optional</em></label><UTextarea id="recurring-description" v-model="form.description" :rows="4" maxlength="5000" /></div>
      </form></template>
      <template #footer><UButton color="neutral" variant="outline" @click="open = false">Cancel</UButton><UButton type="submit" form="recurring-coursework-form" :loading="saving">Create and generate</UButton></template>
    </UModal>
  </section>
</template>

<style scoped>
.coursework-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; margin:1rem 0; overflow:hidden; border:1px solid var(--ns-border); border-radius:.75rem; background:var(--ns-border); }
.coursework-summary div { display:grid; gap:.2rem; padding:.8rem; background:#f8f6ef; }
.coursework-summary strong { font-size:1.25rem; }.coursework-summary span,.coursework-list span { color:var(--ns-text-muted); font-size:.72rem; }
.coursework-list { display:grid; gap:.8rem; }.coursework-list article { display:grid; gap:.7rem; border:1px solid var(--ns-border); border-radius:.8rem; padding:1rem; background:white; }.coursework-list article.archived { opacity:.65; }
.coursework-heading { display:flex; justify-content:space-between; gap:.7rem; }.coursework-heading > div { display:grid; gap:.2rem; }
.coursework-progress { height:7px; overflow:hidden; border-radius:999px; background:#dce6e1; }.coursework-progress span { display:block; height:100%; background:var(--ns-accent); }
.coursework-list p { color:var(--ns-text-secondary); font-size:.8rem; }.coursework-warning { display:flex; gap:.4rem; color:#765617!important; }
.coursework-check { display:flex; gap:.5rem; align-items:center; min-height:42px; font-size:.82rem; }
@media (max-width:800px) { .coursework-summary { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:600px) { .coursework-summary { grid-template-columns:1fr; }.coursework-heading { flex-direction:column; } }
</style>
