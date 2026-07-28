<script setup>
import { calculateGradeIntelligence } from '#shared/academic/grade-intelligence'
const props = defineProps({ enrolmentId: { type: String, required: true } })
const { records, loading, saving, error, fieldErrors, load, create, setTarget } = useAssessments()
const open = ref(false)
const target = reactive({ targetPercentage: null, targetLabel: '' })
const scenarios = ref({})
const form = reactive({ name: '', type: 'OTHER', weight: null, officialDeadline: '', status: 'NOT_STARTED', score: null, maximumScore: null })
const data = computed(() => records.value[props.enrolmentId] || { assessments: [] })
const intelligence = computed(() => calculateGradeIntelligence(data.value.assessments, data.value.targetPercentage, scenarios.value))
const ungraded = computed(() => data.value.assessments.filter(item => item.percentageScore === null && item.status !== 'CANCELLED'))
const types = ['QUIZ','MIDTERM','FINAL_EXAMINATION','INDIVIDUAL_ASSIGNMENT','GROUP_ASSIGNMENT','PRESENTATION','CLASS_PARTICIPATION','ATTENDANCE','REFLECTION','CASE_ANALYSIS','REPORT','PROJECT','PRACTICAL','LABORATORY','ORAL_EXAMINATION','PEER_ASSESSMENT','OTHER']
onMounted(async () => { const value = await load(props.enrolmentId); if (value) Object.assign(target, { targetPercentage: value.targetPercentage, targetLabel: value.targetLabel || '' }) })
const label = value => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const dateInput = value => value ? new Date(value).toISOString() : null
const formatDate = value => value ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(new Date(value)) : 'No deadline'
const daysRemaining = value => value ? Math.ceil((new Date(value).setHours(23,59,59,999) - Date.now()) / 86400000) : null
async function add() {
  const result = await create(props.enrolmentId, { ...form, weight: form.weight, officialDeadline: dateInput(form.officialDeadline), score: form.score, maximumScore: form.maximumScore })
  if (result) { open.value = false; Object.assign(form, { name: '', type: 'OTHER', weight: null, officialDeadline: '', status: 'NOT_STARTED', score: null, maximumScore: null }) }
}
async function saveTarget() { await setTarget(props.enrolmentId, { targetPercentage: target.targetPercentage, targetLabel: target.targetLabel || null }) }
function resetScenarios() { scenarios.value = {} }
</script>

<template>
  <section id="assessments" class="dossier-section academic-panel" aria-labelledby="assessment-title">
    <div class="dossier-section__heading"><div><p>Private academic record</p><h2 id="assessment-title">Assessments</h2></div><div class="academic-actions"><UButton color="neutral" variant="outline" @click="open = true">Add manually</UButton><UButton href="#course-outline">Import outline</UButton></div></div>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Loading assessments…</p>
    <div v-else-if="data.assessments.length" class="assessment-list">
      <NuxtLink v-for="item in data.assessments" :key="item.id" :to="`/app/assessments/${item.id}`">
        <div><strong>{{ item.name }}</strong><span>{{ label(item.type) }} · {{ item.weight ?? '—' }}%</span></div>
        <div><span>{{ formatDate(item.officialDeadline) }}</span><small v-if="daysRemaining(item.officialDeadline) !== null">{{ daysRemaining(item.officialDeadline) < 0 ? 'Overdue' : `${daysRemaining(item.officialDeadline)} days remaining` }}</small></div>
        <UBadge color="neutral" variant="outline">{{ label(item.status) }}</UBadge>
        <strong>{{ item.weightedScore === null ? 'Not graded' : `${item.weightedScore}% contribution` }}</strong>
      </NuxtLink>
    </div>
    <p v-else class="dossier-empty">No confirmed assessments. Add one manually or import a course outline.</p>

    <div class="grade-dashboard" aria-labelledby="grade-title">
      <div class="grade-dashboard__heading"><div><p>Deterministic estimate</p><h3 id="grade-title">Grade intelligence</h3></div><form @submit.prevent="saveTarget"><label for="target-percentage">Personal target %</label><UInput id="target-percentage" v-model.number="target.targetPercentage" type="number" min="0" max="100" step="0.1" /><label for="target-label">Optional label</label><UInput id="target-label" v-model="target.targetLabel" maxlength="50" placeholder="A target" /><UButton type="submit" size="sm" :loading="saving">Save target</UButton></form></div>
      <dl>
        <div><dt>Current weighted score</dt><dd>{{ intelligence.currentWeightedScore }}%</dd></div>
        <div><dt>Graded weight</dt><dd>{{ intelligence.gradedWeight }}%</dd></div>
        <div><dt>Remaining weight</dt><dd>{{ intelligence.remainingWeight }}%</dd></div>
        <div><dt>Projected result</dt><dd>{{ intelligence.projectedFinal === null ? 'Insufficient data' : `${intelligence.projectedFinal}%` }}</dd></div>
        <div><dt>Required remaining average</dt><dd>{{ intelligence.requiredAverage === null ? 'Set a target' : `${intelligence.requiredAverage}%` }}</dd></div>
        <div><dt>Best case</dt><dd>{{ intelligence.bestCase }}%</dd></div>
      </dl>
      <p class="grade-state"><UIcon name="i-lucide-info" /> {{ label(intelligence.targetState) }}. These are personal estimates, not official grade boundaries.</p>
      <ul v-if="intelligence.warnings.length"><li v-for="warning in intelligence.warnings" :key="warning">{{ warning }}</li></ul>
      <div v-if="ungraded.length" class="grade-scenarios"><div><h4>Hypothetical scenarios</h4><UButton color="neutral" variant="ghost" size="sm" @click="resetScenarios">Reset scenarios</UButton></div><p>Temporary values stay in this browser view and never overwrite confirmed scores.</p><label v-for="item in ungraded" :key="item.id" :for="`scenario-${item.id}`"><span>{{ item.name }} ({{ item.weight ?? '—' }}%)</span><UInput :id="`scenario-${item.id}`" v-model.number="scenarios[item.id]" type="number" min="0" max="100" step=".1" placeholder="Expected %" /></label></div>
    </div>

    <UModal v-model:open="open" title="Add assessment" description="Create a private confirmed assessment.">
      <template #body><form id="assessment-form" class="module-form" @submit.prevent="add">
        <div class="module-field"><label for="assessment-name">Name</label><UInput id="assessment-name" v-model="form.name" required maxlength="200" /><small>{{ fieldErrors.name }}</small></div>
        <div class="module-form__grid"><div class="module-field"><label for="assessment-type">Type</label><USelect id="assessment-type" v-model="form.type" :items="types" /></div><div class="module-field"><label for="assessment-weight">Weight %</label><UInput id="assessment-weight" v-model.number="form.weight" type="number" min="0" max="100" step="0.1" /></div></div>
        <div class="module-field"><label for="assessment-deadline">Official deadline</label><input id="assessment-deadline" v-model="form.officialDeadline" type="datetime-local"></div>
      </form></template>
      <template #footer><UButton color="neutral" variant="outline" @click="open = false">Cancel</UButton><UButton type="submit" form="assessment-form" :loading="saving">Add assessment</UButton></template>
    </UModal>
  </section>
</template>
