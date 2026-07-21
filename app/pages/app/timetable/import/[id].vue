<script setup>
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, REGISTRATION_STATUSES, SESSION_RECURRENCES } from '~~/shared/schemas/timetable'
import { findTimetableConflicts } from '~/utils/timetable-import/timetable-conflicts'
import { formatMinutes, parseTime } from '~/utils/timetable-import/timetable-time'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Review timetable import · Northstar' })
const route = useRoute()
const router = useRouter()
const { user } = useCurrentSession()
const { imports, loading, saving, error, fieldErrors, loadImport, updateImport, confirmImport, cancelImport } = useTimetable()
const loadedDraft = ref(null)
const draft = computed(() => loadedDraft.value || imports.value[route.params.id])
const modules = ref([])
const result = ref(null)
const selectedSessions = computed(() => modules.value.filter(module => module.selected).flatMap(module => module.sessions.filter(session => session.selected).map(session => ({ ...session, code: module.code }))))
const conflicts = computed(() => findTimetableConflicts(selectedSessions.value))
const needsAttention = computed(() => modules.value.reduce((count, module) => count + module.sessions.filter(session => session.selected && (!session.dayOfWeek || session.startMinutes === null || session.endMinutes === null || session.endMinutes <= session.startMinutes)).length, 0))
const canConfirm = computed(() => modules.value.some(module => module.selected) && needsAttention.value === 0)
const cloneModules = value => JSON.parse(JSON.stringify(value || []))

watch(draft, value => { if (value && !modules.value.length) modules.value = cloneModules(value.modules) }, { immediate: true })
watch([user, () => route.params.id], ([current, id]) => {
  if (current && id) void loadImport(id).then(value => {
    loadedDraft.value = value
    if (!modules.value.length) modules.value = cloneModules(value.modules)
  }).catch(() => {})
}, { immediate: true })
function confidence(value, session = null) { if (session && (!session.dayOfWeek || session.endMinutes === null)) return 'Missing information'; return value >= 0.75 ? 'High confidence' : 'Check this' }
function timeValue(session, key) { return formatMinutes(session[key]) }
function setTime(session, key, event) { session[key] = event.target.value ? parseTime(event.target.value) : null }
async function saveReview() { const value = await updateImport(route.params.id, { modules: modules.value, warnings: draft.value.warnings }); if (value) loadedDraft.value = value; return value }
async function confirm() { const saved = await saveReview(); if (!saved) return; result.value = await confirmImport(route.params.id, { expectedUpdatedAt: saved.updatedAt, modules: modules.value }) }
async function cancel() { if (await cancelImport(route.params.id)) await router.push('/app/timetable/import') }
</script>
<template>
  <main class="app-page review-page">
    <div v-if="!draft && loading" class="module-loading" role="status">Loading review…</div>
    <p v-else-if="!draft" class="module-alert">{{ error || 'Import review unavailable.' }}</p>
    <template v-else-if="result">
      <section class="module-empty"><span class="module-empty__icon"><UIcon name="i-lucide-calendar-check" /></span><p>Import confirmed</p><h1>Your timetable is ready</h1><span>{{ result.modulesCreated }} modules created, {{ result.modulesReused }} reused, {{ result.sessionsCreated }} sessions added, and {{ result.duplicatesSkipped }} duplicates skipped.</span><UButton to="/app/timetable" size="lg">View timetable</UButton></section>
    </template>
    <template v-else>
      <header class="app-page__header"><div><p class="app-page__eyebrow">Nothing is saved until confirmation</p><h1>Review what Northstar found</h1><span>Correct uncertain fields or exclude anything that does not belong.</span></div></header>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <section class="review-summary"><div><strong>{{ modules.length }}</strong><span>modules detected</span></div><div><strong>{{ selectedSessions.length }}</strong><span>sessions included</span></div><div><strong>{{ needsAttention }}</strong><span>fields needing attention</span></div><div><strong>{{ conflicts.length }}</strong><span>conflicts detected</span></div></section>
      <p v-if="draft.source === 'NTU_TIMETABLE_IMAGE'" class="privacy-callout"><UIcon name="i-lucide-flask-conical" /> Weekly-grid parsing is beta. Check every inferred day and enter every missing end time.</p>
      <section v-for="module in modules" :key="module.candidateId" class="review-module" :class="{ 'is-excluded': !module.selected }">
        <header><label><input v-model="module.selected" type="checkbox"> Include</label><strong>{{ module.code || 'Module' }}</strong><UBadge :color="module.confidence >= .75 ? 'success' : 'warning'" variant="soft">{{ confidence(module.confidence) }}</UBadge></header>
        <div class="review-fields"><label>Code<input v-model.trim="module.code" maxlength="20"></label><label>Title<input v-model.trim="module.title" placeholder="Required for a new module" maxlength="160"><small v-if="module.selected && !module.title">Enter the module title.</small></label><label>AU<input v-model.number="module.academicUnits" type="number" min="0.5" max="30" step="0.5"></label><label>Index number<input v-model.trim="module.indexNumber" maxlength="20"></label><label>Course type<input v-model.trim="module.courseType" maxlength="100"></label><label>Status<select v-model="module.registrationStatus"><option v-for="item in REGISTRATION_STATUSES" :key="item">{{ item }}</option></select></label></div>
        <div class="review-sessions"><article v-for="session in module.sessions" :key="session.candidateId" :class="{ 'needs-attention': session.selected && (!session.dayOfWeek || session.endMinutes === null) }"><div class="review-session__heading"><label><input v-model="session.selected" type="checkbox"> Include session</label><UBadge :color="session.confidence >= .75 ? 'success' : 'warning'" variant="soft">{{ confidence(session.confidence, session) }}</UBadge></div><div class="review-fields"><label>Class type<select v-model="session.classType"><option v-for="item in CLASS_SESSION_TYPES" :key="item">{{ item }}</option></select></label><label>Group<input v-model.trim="session.groupLabel"></label><label>Day<select v-model="session.dayOfWeek"><option :value="null">Choose day</option><option v-for="item in DAYS_OF_WEEK" :key="item">{{ item }}</option></select></label><label>Start<input type="time" :value="timeValue(session, 'startMinutes')" @input="setTime(session, 'startMinutes', $event)"></label><label>End<input type="time" :value="timeValue(session, 'endMinutes')" @input="setTime(session, 'endMinutes', $event)"></label><label>Venue<input v-model.trim="session.venue" maxlength="200"></label><label>Recurrence<select v-model="session.recurrence"><option v-for="item in SESSION_RECURRENCES" :key="item">{{ item }}</option></select></label></div><ul v-if="session.warnings.length"><li v-for="warning in session.warnings" :key="warning">{{ warning }}</li></ul></article><p v-if="!module.sessions.length">No sessions detected. You can add them manually after confirmation.</p></div>
      </section>
      <section class="review-preview"><h2>Weekly preview</h2><p v-if="!selectedSessions.length">No complete sessions to preview.</p><ol><li v-for="session in selectedSessions" :key="session.candidateId"><strong>{{ session.code }}</strong> {{ session.dayOfWeek || 'Day missing' }} · {{ formatMinutes(session.startMinutes) || 'Start missing' }}–{{ formatMinutes(session.endMinutes) || 'End missing' }}</li></ol><p v-if="conflicts.length" class="module-alert">{{ conflicts.length }} overlapping session pair{{ conflicts.length === 1 ? '' : 's' }} found.</p></section>
      <p v-if="Object.keys(fieldErrors).length" class="module-alert">Some reviewed fields are invalid. Check highlighted or missing information.</p>
      <footer class="review-actions"><UButton color="neutral" variant="ghost" @click="cancel">Cancel import</UButton><UButton color="neutral" variant="outline" :loading="saving" @click="saveReview">Save review</UButton><UButton :disabled="!canConfirm" :loading="saving" @click="confirm">Confirm and build timetable</UButton></footer>
    </template>
  </main>
</template>
