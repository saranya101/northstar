<script setup>
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, REGISTRATION_STATUSES, SESSION_DELIVERY_MODES, SESSION_RECURRENCES } from '~~/shared/schemas/timetable'
import { findTimetableConflicts } from '~/utils/timetable-import/timetable-conflicts'
import { deliveryModeIcon, deliveryModeLabel } from '~/utils/timetable-import/timetable-delivery'
import { parseNtuSessionBlock } from '~/utils/timetable-import/ntu-session-block-parser'
import { formatMinutes, parseTime } from '~/utils/timetable-import/timetable-time'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Review timetable import · Northstar' })
const route = useRoute()
const router = useRouter()
const { user } = useCurrentSession()
const { state: onboarding } = useOnboarding()
const { imports, loading, saving, error, fieldErrors, loadImport, updateImport, confirmImport, cancelImport, enrichModule } = useTimetable()
const loadedDraft = ref(null)
const draft = computed(() => loadedDraft.value || imports.value[route.params.id])
const modules = ref([])
const result = ref(null)
const enrichments = reactive({})
const enrichmentLoading = reactive(new Set())
const attemptedEnrichment = new Set()
const unmatchedText = ref([])
const selectedSessions = computed(() => modules.value.filter(module => module.selected).flatMap(module => module.sessions.filter(session => session.selected).map(session => ({ ...session, code: module.code }))))
const conflicts = computed(() => findTimetableConflicts(selectedSessions.value))
const needsAttention = computed(() => modules.value.reduce((count, module) => count + Number(module.selected && !module.publicEnrichmentConfirmed) + module.sessions.filter(session => session.selected && (!session.dayOfWeek || session.startMinutes === null || session.endMinutes === null || session.endMinutes <= session.startMinutes || session.timeConfirmed === false || !session.deliveryModeConfirmed || !session.recurrenceConfirmed)).length, 0))
const canConfirm = computed(() => modules.value.some(module => module.selected) && needsAttention.value === 0 && draft.value?.semesterMatchStatus === 'MATCH')
const cloneModules = value => JSON.parse(JSON.stringify(value || []))

watch(draft, value => { if (value && !modules.value.length) { modules.value = cloneModules(value.modules); unmatchedText.value = cloneModules(value.unmatchedTimetableText); void enrichAll() } }, { immediate: true })
watch([user, () => route.params.id], ([current, id]) => {
  if (current && id) void loadImport(id).then(value => {
    loadedDraft.value = value
    if (!modules.value.length) { modules.value = cloneModules(value.modules); unmatchedText.value = cloneModules(value.unmatchedTimetableText); void enrichAll() }
  }).catch(() => {})
}, { immediate: true })
watch(() => onboarding.value?.semester?.academicTerm, term => { if (term && modules.value.length) void enrichAll() })
function confidence(value, session = null) { if (session && (!session.dayOfWeek || session.endMinutes === null)) return 'Missing information'; return value >= 0.75 ? 'High confidence' : 'Check this' }
function timeValue(session, key) { return formatMinutes(session[key]) }
function setTime(session, key, event) { session[key] = event.target.value ? parseTime(event.target.value) : null }
function publicPayload(value) { return { title: value.title, academicUnits: value.academicUnits, description: value.description, gradingBasis: value.gradingBasis, school: value.school, officialUrl: value.officialUrl, fieldProvenance: value.fieldProvenance, verificationStatus: value.verificationStatus } }
function applyEnrichment(module, useSuggestion = true) {
  const value = enrichments[module.candidateId]
  if (!value?.available) { module.publicEnrichmentConfirmed = true; return }
  if (useSuggestion) {
    if (value.title) module.title = value.title
    if (value.academicUnits !== null) module.academicUnits = value.academicUnits
  }
  module.publicEnrichment = publicPayload(value)
  module.publicEnrichmentConfirmed = true
}
async function enrichOne(module) {
  if (!/^(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{2,20}$/.test(module.code) || attemptedEnrichment.has(module.candidateId)) return
  const sourceSemester = draft.value?.sourceSemester
  const term = sourceSemester ? { academicYear: sourceSemester.academicYearLabel, name: `Semester ${sourceSemester.semesterNumber}` } : onboarding.value?.semester?.academicTerm
  if (!term) return
  attemptedEnrichment.add(module.candidateId)
  enrichmentLoading.add(module.candidateId)
  const value = await enrichModule({ code: module.code, academicYear: term.academicYear, semester: term.name, indexNumber: module.indexNumber, importedTitle: module.title })
  enrichments[module.candidateId] = value
  enrichmentLoading.delete(module.candidateId)
  if (value.available && value.verificationStatus === 'PUBLIC_SOURCE_MATCH') applyEnrichment(module, true)
  else if (value.verificationStatus === 'PUBLIC_SOURCE_CONFLICT' || value.reason?.includes('not found')) module.publicEnrichmentConfirmed = false
}
async function enrichAll() { await Promise.all(modules.value.map(enrichOne)) }
function setDeliveryMode(session, value) { session.deliveryMode = value; session.deliveryModeConfirmed = value !== 'UNKNOWN' }
function setRecurrence(session, value) { session.recurrence = value; session.recurrenceConfirmed = true; if (value !== 'CUSTOM') session.weekNumbers = [] }
function setWeeks(session, event) { session.weekNumbers = [...new Set(event.target.value.split(/[, ]+/).filter(Boolean).map(Number).filter(value => value >= 1 && value <= 20))].sort((left, right) => left - right) }
function chooseTime(session, source) { const alternative = session.timeAlternatives; session.startMinutes = alternative[`${source}StartMinutes`]; session.endMinutes = alternative[`${source}EndMinutes`]; session.timeConfirmed = true }
function attachUnmatched(item) { const module = modules.value.find(value => value.candidateId === item.attachToCandidateId); if (!module) return; const session = parseNtuSessionBlock(item.text, { confidence: 0.3, warnings: ['Attached manually from unmatched OCR text. Confirm every field.'] }); if (session) module.sessions.push(session); unmatchedText.value = unmatchedText.value.filter(value => value.candidateId !== item.candidateId) }
async function saveReview() { const value = await updateImport(route.params.id, { modules: modules.value, unmatchedTimetableText: unmatchedText.value, warnings: draft.value.warnings }); if (value) loadedDraft.value = value; return value }
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
      <section class="dossier-section semester-review" :class="{ 'needs-attention': draft.semesterMatchStatus !== 'MATCH' }"><div class="dossier-section__heading"><div><p>Uploaded semester</p><h2>{{ draft.sourceSemester?.displayLabel || 'Semester not detected' }}</h2></div><UBadge :color="draft.semesterMatchStatus === 'MATCH' ? 'success' : 'error'">{{ draft.semesterMatchStatus }}</UBadge></div><p><strong>Selected target:</strong> {{ draft.targetSemester?.displayLabel || 'No target selected' }}</p><div v-if="draft.semesterMatchStatus === 'MISMATCH'" class="module-alert"><strong>Semester mismatch</strong><br>Uploaded timetable: {{ draft.sourceSemester.displayLabel }}<br>Your active semester: {{ draft.targetSemester.displayLabel }}<p>Select or create the matching semester through Settings, then cancel and review this upload again. Northstar will not switch semesters silently.</p><div class="enrichment-actions"><UButton to="/app/settings" color="neutral" variant="outline">Open semester settings</UButton><UButton color="error" variant="outline" @click="cancel">Cancel this import</UButton></div></div><p v-else-if="draft.semesterMatchStatus === 'UNKNOWN'" class="module-alert">The source semester was not readable. Select a target semester explicitly before importing.</p></section>
      <section class="review-summary"><div><strong>{{ modules.length }}</strong><span>modules detected</span></div><div><strong>{{ selectedSessions.length }}</strong><span>sessions included</span></div><div><strong>{{ needsAttention }}</strong><span>fields needing attention</span></div><div><strong>{{ conflicts.length }}</strong><span>conflicts detected</span></div></section>
      <p v-if="draft.sourceSummary" class="privacy-callout"><UIcon name="i-lucide-table-properties" /> Registered-course table: {{ draft.sourceSummary.moduleCount ?? modules.length }} courses · {{ draft.sourceSummary.totalAcademicUnits ?? '—' }} AU · {{ modules.filter(module => module.examCandidate?.applicable).length }} exam schedules.</p>
      <p v-if="draft.source === 'NTU_TIMETABLE_IMAGE'" class="privacy-callout"><UIcon name="i-lucide-flask-conical" /> Weekly-grid parsing is beta. Check every inferred day and enter every missing end time.</p>
      <section v-for="module in modules" :key="module.candidateId" class="review-module" :class="{ 'is-excluded': !module.selected }">
        <header><label><input v-model="module.selected" type="checkbox"> Include</label><strong>{{ module.code || 'Module' }}</strong><UBadge :color="module.confidence >= .75 ? 'success' : 'warning'" variant="soft">{{ confidence(module.confidence) }}</UBadge></header>
        <div class="review-layer-label"><UIcon name="i-lucide-file-input" /><strong>Imported from your timetable</strong><span>Index-specific details remain the source of truth.</span></div>
        <div class="review-fields"><label>Code<input v-model.trim="module.code" maxlength="20"></label><label>Title<input v-model.trim="module.title" placeholder="Required for a new module" maxlength="160"><small v-if="module.selected && !module.title">Enter the module title.</small></label><label>AU<input v-model.number="module.academicUnits" type="number" min="0.5" max="30" step="0.5"></label><label>Index number<input v-model.trim="module.indexNumber" maxlength="20"></label><label>Course type<input v-model.trim="module.courseType" maxlength="100"></label><label>Status<select v-model="module.registrationStatus"><option v-for="item in REGISTRATION_STATUSES" :key="item">{{ item }}</option></select></label><label>Exam schedule<input :value="module.examCandidate?.applicable ? module.examCandidate.rawText : 'Not Applicable'" readonly></label></div><p v-if="module.fieldProvenance" class="review-provenance">Fields above were reconstructed from the uploaded registered-course table.</p><ul v-if="module.corrections?.length" class="review-corrections"><li v-for="correction in module.corrections" :key="`${correction.original}-${correction.corrected}`">OCR read {{ correction.original }}. Corrected to {{ correction.corrected }} using the registered-course table.</li></ul>
        <div class="public-enrichment">
          <div class="review-layer-label"><UIcon name="i-lucide-landmark" /><strong>Found in NTU public information</strong><span>Suggestions only; never a replacement for your selected index.</span></div>
          <p v-if="enrichmentLoading.has(module.candidateId)" role="status">Checking public NTU course information…</p>
          <template v-else-if="enrichments[module.candidateId]?.available"><p><strong>{{ enrichments[module.candidateId].title || 'Title not listed' }}</strong><span>{{ enrichments[module.candidateId].academicUnits ? ` · ${enrichments[module.candidateId].academicUnits} AU` : '' }}</span></p><p v-if="enrichments[module.candidateId].school"><strong>School:</strong> {{ enrichments[module.candidateId].school }}</p><p v-if="enrichments[module.candidateId].description">{{ enrichments[module.candidateId].description }}</p><p v-if="enrichments[module.candidateId].gradingBasis"><strong>Grading basis:</strong> {{ enrichments[module.candidateId].gradingBasis }}</p><p>{{ enrichments[module.candidateId].message }}</p><p v-if="enrichments[module.candidateId].indexValidation?.status === 'MATCH'"><strong>Registered index {{ module.indexNumber }} matched the selected public semester.</strong></p><p v-else-if="enrichments[module.candidateId].indexValidation?.status === 'NOT_FOUND'">{{ enrichments[module.candidateId].indexValidation.message }}</p><a :href="enrichments[module.candidateId].officialUrl" target="_blank" rel="noopener">View public source</a><div v-if="enrichments[module.candidateId].verificationStatus === 'PUBLIC_SOURCE_CONFLICT' && !module.publicEnrichmentConfirmed" class="enrichment-actions"><UButton size="sm" @click="applyEnrichment(module, true)">Use public suggestion</UButton><UButton size="sm" color="neutral" variant="outline" @click="applyEnrichment(module, false)">Keep imported details</UButton></div></template>
          <template v-else-if="enrichments[module.candidateId]"><p>{{ enrichments[module.candidateId].reason }}</p><UButton v-if="!module.publicEnrichmentConfirmed" size="sm" color="neutral" variant="outline" @click="module.publicEnrichmentConfirmed = true">Keep this unmatched code</UButton></template>
        </div>
        <div class="review-sessions"><div class="review-layer-label"><UIcon name="i-lucide-calendar-clock" /><strong>Timetable sessions and confirmation</strong><span>Resolve every highlighted delivery, week, day, and time field.</span></div><article v-for="session in module.sessions" :key="session.candidateId" :class="{ 'needs-attention': session.selected && (!session.dayOfWeek || session.endMinutes === null || session.timeConfirmed === false || !session.deliveryModeConfirmed || !session.recurrenceConfirmed) }"><div class="review-session__heading"><label><input v-model="session.selected" type="checkbox"> Include session</label><UBadge :color="session.confidence >= .75 ? 'success' : 'warning'" variant="soft">{{ confidence(session.confidence, session) }}</UBadge></div><div class="review-fields"><label>Class type<select v-model="session.classType"><option v-for="item in CLASS_SESSION_TYPES" :key="item">{{ item }}</option></select></label><label>Group<input v-model.trim="session.groupLabel"></label><label>Day<select v-model="session.dayOfWeek"><option :value="null">Choose day</option><option v-for="item in DAYS_OF_WEEK" :key="item">{{ item }}</option></select></label><label>Start<input type="time" :value="timeValue(session, 'startMinutes')" @input="setTime(session, 'startMinutes', $event)"></label><label>End<input type="time" :value="timeValue(session, 'endMinutes')" @input="setTime(session, 'endMinutes', $event)"></label><label>Venue<input v-model.trim="session.venue" maxlength="200"></label><label>Delivery mode<span class="delivery-control"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /><select :value="session.deliveryMode" @change="setDeliveryMode(session, $event.target.value)"><option v-for="item in SESSION_DELIVERY_MODES" :key="item" :value="item">{{ deliveryModeLabel(item) }}</option></select></span></label><label>Recurrence<select :value="session.recurrence" @change="setRecurrence(session, $event.target.value)"><option v-for="item in SESSION_RECURRENCES" :key="item">{{ item }}</option></select></label><label v-if="session.recurrence === 'CUSTOM'">Teaching weeks<input :value="session.weekNumbers.join(', ')" placeholder="2, 3, 4" @input="setWeeks(session, $event)"></label></div><div v-if="session.timeConfirmed === false && session.timeAlternatives" class="enrichment-actions"><UButton size="sm" @click="chooseTime(session, 'explicit')">Use time printed in cell</UButton><UButton size="sm" color="neutral" variant="outline" @click="chooseTime(session, 'geometry')">Use grid position</UButton></div><label v-if="session.deliveryMode === 'UNKNOWN' && !session.deliveryModeConfirmed" class="review-confirm"><input v-model="session.deliveryModeConfirmed" type="checkbox"> Confirm unknown delivery mode</label><label v-if="session.recurrence === 'WEEKLY' && !session.recurrenceConfirmed" class="review-confirm"><input v-model="session.recurrenceConfirmed" type="checkbox"> Confirm this class occurs every teaching week</label><ul v-if="session.warnings.length"><li v-for="warning in session.warnings" :key="warning">{{ warning }}</li></ul></article><p v-if="!module.sessions.length">No sessions detected. You can add them manually after confirmation.</p></div>
      </section>
      <section v-if="unmatchedText.length" class="dossier-section"><div class="dossier-section__heading"><div><p>Review only</p><h2>Unmatched timetable text</h2></div><UBadge color="warning">{{ unmatchedText.length }}</UBadge></div><p>These OCR blocks were not allowed to create module cards.</p><article v-for="item in unmatchedText" :key="item.candidateId" class="unmatched-block"><textarea v-model="item.text" rows="2" /><select v-model="item.attachToCandidateId"><option :value="null">Choose a registered module</option><option v-for="module in modules" :key="module.candidateId" :value="module.candidateId">{{ module.code }}</option></select><div class="enrichment-actions"><UButton size="sm" :disabled="!item.attachToCandidateId" @click="attachUnmatched(item)">Attach manually</UButton><UButton size="sm" color="neutral" variant="ghost" @click="unmatchedText = unmatchedText.filter(value => value.candidateId !== item.candidateId)">Ignore</UButton></div></article></section>
      <section class="review-preview"><h2>Weekly preview</h2><p v-if="!selectedSessions.length">No complete sessions to preview.</p><ol><li v-for="session in selectedSessions" :key="session.candidateId"><strong>{{ session.code }}</strong> {{ session.dayOfWeek || 'Day missing' }} · {{ formatMinutes(session.startMinutes) || 'Start missing' }}–{{ formatMinutes(session.endMinutes) || 'End missing' }} · <span class="delivery-label"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /> {{ deliveryModeLabel(session.deliveryMode) }}</span> · {{ session.recurrence === 'CUSTOM' ? `Weeks ${session.weekNumbers.join(', ')}` : session.recurrence }}</li></ol><p v-if="conflicts.length" class="module-alert">{{ conflicts.length }} overlapping session pair{{ conflicts.length === 1 ? '' : 's' }} found.</p></section>
      <p v-if="Object.keys(fieldErrors).length" class="module-alert">Some reviewed fields are invalid. Check highlighted or missing information.</p>
      <footer class="review-actions"><UButton color="neutral" variant="ghost" @click="cancel">Cancel import</UButton><UButton color="neutral" variant="outline" :loading="saving" @click="saveReview">Save review</UButton><UButton :disabled="!canConfirm" :loading="saving" @click="confirm">Confirm and build timetable</UButton></footer>
    </template>
  </main>
</template>
