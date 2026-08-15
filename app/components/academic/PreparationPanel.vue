<script setup>
import { derivePreparationReadiness, normalizePreparation } from '#shared/academic/preparation'
import { buildTimetableEvents, dateKey, dateTimeKey, startOfWeekMonday } from '#shared/calendar/events'

const props = defineProps({
  enrolmentId: { type: String, required: true },
  moduleCode: { type: String, required: true },
  classSessions: { type: Array, default: () => [] },
  academicTerm: { type: Object, required: true }
})
const route = useRoute()
const requestFetch = useRequestFetch()
const overview = ref(null)
const preparation = ref(null)
const selectedWeek = ref(null)
const questionsDraft = ref('')
const loading = ref(false)
const savingField = ref('')
const error = ref('')
const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']
const fields = [
  ['materialStatus', 'Material'], ['notesStatus', 'Notes'],
  ['requiredWorkStatus', 'Required work'], ['practiceStatus', 'Practice']
]
const now = new Date()
const nowKey = dateTimeKey(now)
const todayMonday = startOfWeekMonday(dateKey(now))
const events = computed(() => buildTimetableEvents({
  sessions: props.classSessions.map(session => ({ ...session, enrolmentId: props.enrolmentId, module: { code: props.moduleCode } })),
  activeSemester: { teachingStartDate: props.academicTerm.teachingStartDate, teachingEndDate: props.academicTerm.teachingEndDate, recessStartDate: props.academicTerm.recessStartDate, recessEndDate: props.academicTerm.recessEndDate }
}))
const allWeeks = computed(() => [...new Set(events.value.map(event => event.weekNumber))].sort((a, b) => a - b))
const moduleOverview = computed(() => overview.value?.modules?.find(module => module.enrolmentId === props.enrolmentId) || null)
const persistedByWeek = computed(() => new Map((moduleOverview.value?.preparations || []).map(item => [item.teachingWeek, item])))
const priorityWeeks = computed(() => {
  const current = events.value.find(event => startOfWeekMonday(event.dateKey) === todayMonday)?.weekNumber
  const next = events.value.find(event => event.start >= nowKey)?.weekNumber
  const previousEvents = events.value.filter(event => event.start < nowKey).toReversed()
  const recent = previousEvents.find(event => derivePreparationReadiness(persistedByWeek.value.get(event.weekNumber)) !== 'READY')?.weekNumber
  return [...new Set([current, next, recent].filter(week => allWeeks.value.includes(week)))].slice(0, 3)
})
const readiness = computed(() => derivePreparationReadiness(preparation.value))

function humanize(value) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
}

async function loadWeek(week) {
  if (!week) return
  loading.value = true; error.value = ''
  try {
    preparation.value = await requestFetch(`/api/preparation/${props.enrolmentId}/${week}`)
    questionsDraft.value = preparation.value.questions || ''
  } catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load class preparation.' }
  finally { loading.value = false }
}

async function updateField(field, value) {
  if (!selectedWeek.value || savingField.value) return
  const previous = preparation.value
  preparation.value = { ...normalizePreparation(previous), [field]: value }
  savingField.value = field; error.value = ''
  try {
    preparation.value = await requestFetch(`/api/preparation/${props.enrolmentId}/${selectedWeek.value}`, { method: 'PATCH', body: { [field]: value } })
    questionsDraft.value = preparation.value.questions || ''
    const record = moduleOverview.value?.preparations?.find(item => item.teachingWeek === selectedWeek.value)
    if (record) Object.assign(record, preparation.value)
    else if (moduleOverview.value) moduleOverview.value.preparations.push(preparation.value)
  } catch (cause) {
    preparation.value = previous
    error.value = cause?.data?.message || cause?.statusMessage || 'Unable to update class preparation.'
  } finally { savingField.value = '' }
}

async function load() {
  loading.value = true; error.value = ''
  try {
    overview.value = await requestFetch('/api/preparation')
    const requested = Number(route.query.week)
    selectedWeek.value = allWeeks.value.includes(requested) ? requested : priorityWeeks.value[0] || allWeeks.value[0] || null
    if (selectedWeek.value) await loadWeek(selectedWeek.value)
  } catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load class preparation.' }
  finally { loading.value = false }
}

watch(selectedWeek, (week, previous) => { if (previous && week !== previous) void loadWeek(week) })
onMounted(load)
</script>

<template>
  <section id="preparation" class="dossier-section preparation-panel">
    <div class="dossier-section__heading">
      <div><p>Before class</p><h2>Class preparation</h2></div>
      <UBadge :color="readiness === 'READY' ? 'success' : readiness === 'IN_PROGRESS' ? 'warning' : 'neutral'" variant="soft">{{ humanize(readiness) }}</UBadge>
    </div>
    <div class="preparation-week-controls">
      <div class="preparation-priority-weeks" aria-label="Relevant teaching weeks">
        <button v-for="week in priorityWeeks" :key="week" type="button" :class="{ active: selectedWeek === week }" @click="selectedWeek = week">Week {{ week }}</button>
      </div>
      <label>Teaching week <select v-model.number="selectedWeek"><option v-for="week in allWeeks" :key="week" :value="week">Week {{ week }}</option></select></label>
    </div>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <p v-if="loading && !preparation" class="dossier-empty" role="status">Loading preparation…</p>
    <template v-else-if="preparation">
      <div class="preparation-status-list">
        <div v-for="field in fields" :key="field[0]">
          <strong>{{ field[1] }}</strong>
          <select :value="preparation[field[0]]" :disabled="Boolean(savingField)" :aria-label="`${field[1]} status`" @change="updateField(field[0], $event.target.value)"><option v-for="status in statuses" :key="status" :value="status">{{ humanize(status) }}</option></select>
          <UButton size="xs" color="neutral" :variant="preparation[field[0]] === 'DONE' ? 'soft' : 'outline'" :loading="savingField === field[0]" @click="updateField(field[0], preparation[field[0]] === 'DONE' ? 'NOT_STARTED' : 'DONE')">{{ preparation[field[0]] === 'DONE' ? 'Done' : 'Mark done' }}</UButton>
        </div>
      </div>
      <div class="preparation-questions"><label for="preparation-questions">Questions to clarify</label><UTextarea id="preparation-questions" v-model="questionsDraft" :rows="3" maxlength="5000" placeholder="Concepts or questions to raise in class" /><UButton size="sm" color="neutral" variant="outline" :loading="savingField === 'questions'" @click="updateField('questions', questionsDraft)">Save questions</UButton></div>
    </template>
    <p v-else class="dossier-empty">No safely mapped teaching weeks were found for this module.</p>
  </section>
</template>

<style scoped>
.preparation-panel{padding:16px}.preparation-panel :deep(.dossier-section__heading){margin-bottom:12px}.preparation-week-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.preparation-priority-weeks{display:flex;gap:5px}.preparation-priority-weeks button{border:1px solid var(--ns-border);border-radius:5px;padding:6px 9px;background:#fff;color:var(--ns-text-secondary);font-size:.72rem}.preparation-priority-weeks button.active{border-color:var(--ns-accent);background:#e5f1ee;color:var(--ns-accent);font-weight:700}.preparation-week-controls label{display:flex;align-items:center;gap:7px;color:var(--ns-text-muted);font-size:.72rem}.preparation-week-controls select,.preparation-status-list select{min-height:30px;border:1px solid var(--ns-border);border-radius:5px;padding:0 7px;background:#fff;font-size:.75rem}.preparation-status-list{display:grid;border-top:1px solid var(--ns-border)}.preparation-status-list>div{display:grid;grid-template-columns:minmax(140px,1fr) 150px 92px;align-items:center;gap:10px;min-height:46px;border-bottom:1px solid var(--ns-border)}.preparation-status-list strong{font-size:.8rem}.preparation-questions{display:grid;grid-template-columns:minmax(130px,180px) minmax(0,1fr) auto;align-items:start;gap:10px;margin-top:12px}.preparation-questions label{padding-top:8px;font-size:.8rem;font-weight:650}@media(max-width:650px){.preparation-week-controls{align-items:flex-start;flex-direction:column}.preparation-status-list>div{grid-template-columns:1fr 1fr}.preparation-status-list strong{grid-column:1/-1;padding-top:8px}.preparation-status-list>div{padding-bottom:8px}.preparation-questions{grid-template-columns:1fr}.preparation-questions label{padding:0}}
</style>
