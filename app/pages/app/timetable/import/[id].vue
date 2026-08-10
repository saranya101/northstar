<script setup>
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, REGISTRATION_STATUSES, SESSION_DELIVERY_MODES, SESSION_RECURRENCES } from '~~/shared/schemas/timetable'
import { findTimetableConflicts, overlappingWeekNumbers } from '~/utils/timetable-import/timetable-conflicts'
import { deliveryModeIcon, deliveryModeLabel } from '~/utils/timetable-import/timetable-delivery'
import { parseNtuSessionBlock } from '~/utils/timetable-import/ntu-session-block-parser'
import { applyPublicEnrichmentSuggestion, canConfirmReview, cloneReviewModules, groupReviewSessions, initialExpandedModuleIds, initialExpandedSessionIds, moduleIssueCount, revealReviewIssue, reviewIssues, sessionIssueFields } from '~/utils/timetable-import/timetable-review'
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
const expandedModules = reactive(new Set())
const expandedSessions = reactive(new Set())
const selectedSessions = computed(() => modules.value.filter(module => module.selected).flatMap(module => module.sessions.filter(session => session.selected).map(session => ({ ...session, code: module.code }))))
const conflicts = computed(() => findTimetableConflicts(selectedSessions.value))
const attentionItems = computed(() => reviewIssues(modules.value, draft.value))
const needsAttention = computed(() => attentionItems.value.length)
const canConfirm = computed(() => canConfirmReview(modules.value, needsAttention.value, draft.value?.semesterMatchStatus))
const totalAcademicUnits = computed(() => modules.value.reduce((sum, module) => sum + (Number(module.academicUnits) || 0), 0))
const sessionRuleCount = computed(() => modules.value.reduce((count, module) => count + module.sessions.length, 0))
const selectedModuleCount = computed(() => modules.value.filter(module => module.selected).length)

function loadDraft(value) {
  modules.value = cloneReviewModules(value.modules)
  unmatchedText.value = cloneReviewModules(value.unmatchedTimetableText)
  expandedModules.clear(); initialExpandedModuleIds(modules.value).forEach(id => expandedModules.add(id))
  expandedSessions.clear(); initialExpandedSessionIds(modules.value).forEach(id => expandedSessions.add(id))
  void enrichAll()
}

watch(draft, value => { if (value && !modules.value.length) loadDraft(value) }, { immediate: true })
watch([user, () => route.params.id], ([current, id]) => {
  if (current && id) void loadImport(id).then(value => {
    loadedDraft.value = value
    if (!modules.value.length) loadDraft(value)
  }).catch(() => {})
}, { immediate: true })
watch(() => onboarding.value?.semester?.academicTerm, term => { if (term && modules.value.length) void enrichAll() })
function groupedSessions(module) { return groupReviewSessions(module.sessions) }
function moduleIssues(module) { return moduleIssueCount(module) }
function sessionIssues(session) { return sessionIssueFields(session) }
function toggleModule(moduleId) { expandedModules.has(moduleId) ? expandedModules.delete(moduleId) : expandedModules.add(moduleId) }
function trackSessionToggle(sessionId, event) { event.target.open ? expandedSessions.add(sessionId) : expandedSessions.delete(sessionId) }
function variantSummary(session) {
  const weeks = session.recurrence === 'CUSTOM' ? `Weeks ${session.weekNumbers.join(', ') || 'missing'}` : session.recurrence.replaceAll('_', ' ')
  return [session.venue || 'Venue not detected', weeks, deliveryModeLabel(session.deliveryMode)].join(' · ')
}
async function navigateToIssue(issue) {
  const targetId = revealReviewIssue(expandedModules, expandedSessions, issue)
  await nextTick()
  const target = document.getElementById(targetId)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.focus({ preventScroll: true })
}
function timeValue(session, key) { return formatMinutes(session[key]) }
function markManual(session, field) { session.fieldSources ||= {}; session.fieldSources[field] = 'MANUAL' }
function setTime(session, key, event) {
  session[key] = event.target.value ? parseTime(event.target.value, { end: key === 'endMinutes' }) : null
  markManual(session, key)
  session.timeConfirmed = Number.isInteger(session.startMinutes) && Number.isInteger(session.endMinutes) && session.endMinutes > session.startMinutes
  if (session.timeConfirmed) session.timeAlternatives = []
}
function applyEnrichment(module, useSuggestion = true) {
  const value = enrichments[module.candidateId]
  applyPublicEnrichmentSuggestion(module, value, useSuggestion)
}
function keepImportedDetails(module) { applyEnrichment(module, false) }
function confirmTitle(module) { module.titleNeedsReview = false }
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
  else if (value.verificationStatus === 'PUBLIC_SOURCE_CONFLICT' || value.reason?.includes('not found')) { module.publicEnrichmentConfirmed = false; expandedModules.add(module.candidateId) }
}
async function enrichAll() { await Promise.all(modules.value.map(enrichOne)) }
function setDeliveryMode(session, value) { session.deliveryMode = value; session.deliveryModeConfirmed = value !== 'UNKNOWN'; markManual(session, 'deliveryMode') }
function setRecurrence(session, value) { session.recurrence = value; session.recurrenceConfirmed = true; if (value !== 'CUSTOM') session.weekNumbers = []; markManual(session, 'recurrence') }
function setWeeks(session, event) { session.weekNumbers = [...new Set(event.target.value.split(/[, ]+/).filter(Boolean).map(Number).filter(value => value >= 1 && value <= 20))].sort((left, right) => left - right); markManual(session, 'weekNumbers') }
function chooseTime(session, alternative) { session.startMinutes = alternative.startMinutes; session.endMinutes = alternative.endMinutes; session.timeConfirmed = true; session.timeAlternatives = []; markManual(session, 'startMinutes'); markManual(session, 'endMinutes') }
function moveSession(sourceModule, session, targetId) {
  if (!targetId || targetId === sourceModule.candidateId) return
  const target = modules.value.find(module => module.candidateId === targetId)
  if (!target) return
  sourceModule.sessions = sourceModule.sessions.filter(item => item.candidateId !== session.candidateId)
  session.moduleAssignmentConfirmed = true
  markManual(session, 'moduleCode')
  target.sessions.push(session)
  expandedModules.add(target.candidateId)
}
function attachUnmatched(item) {
  const module = modules.value.find(value => value.candidateId === item.attachToCandidateId)
  if (!module) return
  const session = item.sessionCandidate || parseNtuSessionBlock(item.text, { confidence: 0.3, warnings: ['Attached manually from unmatched text. Confirm every field.'] })
  if (!session) return
  session.blockId ||= item.blockId || null
  session.moduleAssignmentConfirmed = true
  session.fieldSources ||= {}
  session.originalValues ||= {}
  markManual(session, 'moduleCode')
  module.sessions.push(session)
  if (item.blockId && draft.value?.structure) {
    draft.value.structure.unresolvedBlockIds = (draft.value.structure.unresolvedBlockIds || []).filter(blockId => blockId !== item.blockId)
    draft.value.structure.droppedSessionBlockCount = draft.value.structure.unresolvedBlockIds.length
  }
  unmatchedText.value = unmatchedText.value.filter(value => value.candidateId !== item.candidateId)
}
function conflictWeeks(first, second) {
  const weeks = overlappingWeekNumbers(first, second)
  return weeks.length >= 20 ? 'Weekly overlap' : `Weeks ${weeks.join(', ')}`
}
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
      <section class="review-summary" aria-label="Import summary"><div><strong>{{ modules.length }}</strong><span>modules</span></div><div><strong>{{ totalAcademicUnits }}</strong><span>AU</span></div><div><strong>{{ sessionRuleCount }}</strong><span>session rules</span></div><div :class="{ 'has-issues': needsAttention }"><strong>{{ needsAttention }}</strong><span>unresolved fields</span></div><div><UBadge :color="draft.semesterMatchStatus === 'MATCH' ? 'success' : 'error'" variant="soft">{{ draft.semesterMatchStatus }}</UBadge><span>semester status</span></div></section>
      <section id="review-structure" class="attention-panel" aria-labelledby="attention-heading" tabindex="-1"><div class="attention-panel__heading"><div><p>Review queue</p><h2 id="attention-heading">Items requiring attention</h2></div><UBadge :color="needsAttention ? 'warning' : 'success'">{{ needsAttention }}</UBadge></div><p v-if="!attentionItems.length" class="attention-panel__empty"><UIcon name="i-lucide-circle-check" /> No unresolved fields.</p><ol v-else class="attention-list"><li v-for="item in attentionItems" :key="item.id"><button type="button" @click="navigateToIssue(item)"><span>{{ item.context }}</span><strong>{{ item.label }}</strong><UIcon name="i-lucide-arrow-down-right" /></button></li></ol></section>
      <section class="dossier-section semester-review" :class="{ 'needs-attention': draft.semesterMatchStatus !== 'MATCH' }"><div class="dossier-section__heading"><div><p>Uploaded semester</p><h2>{{ draft.sourceSemester?.displayLabel || 'Semester not detected' }}</h2></div><UBadge :color="draft.semesterMatchStatus === 'MATCH' ? 'success' : 'error'">{{ draft.semesterMatchStatus }}</UBadge></div><p><strong>Selected target:</strong> {{ draft.targetSemester?.displayLabel || 'No target selected' }}</p><div v-if="draft.semesterMatchStatus === 'MISMATCH'" class="module-alert"><strong>Semester mismatch</strong><br>Uploaded timetable: {{ draft.sourceSemester.displayLabel }}<br>Your active semester: {{ draft.targetSemester.displayLabel }}<p>Select or create the matching semester through Settings, then cancel and review this upload again. Northstar will not switch semesters silently.</p><div class="enrichment-actions"><UButton to="/app/settings" color="neutral" variant="outline">Open semester settings</UButton><UButton color="error" variant="outline" @click="cancel">Cancel this import</UButton></div></div><p v-else-if="draft.semesterMatchStatus === 'UNKNOWN'" class="module-alert">The source semester was not readable. Select a target semester explicitly before importing.</p></section>
      <p v-if="draft.sourceSummary" class="privacy-callout"><UIcon name="i-lucide-table-properties" /> Registered-course table: {{ draft.sourceSummary.moduleCount ?? modules.length }} courses · {{ draft.sourceSummary.totalAcademicUnits ?? '—' }} AU · {{ modules.filter(module => module.examCandidate?.applicable).length }} exam schedules.</p>
      <section v-for="module in modules" :key="module.candidateId" class="review-module" :class="{ 'is-excluded': !module.selected, 'is-collapsed': !expandedModules.has(module.candidateId) }">
        <header class="review-module__summary"><label class="review-module__include"><input v-model="module.selected" type="checkbox"> Include</label><button type="button" class="review-module__toggle" :aria-expanded="expandedModules.has(module.candidateId)" @click="toggleModule(module.candidateId)"><span class="review-module__identity"><strong>{{ module.code || 'Module' }}</strong><span>{{ module.title || 'Title needs review' }}</span></span><span class="review-module__facts"><span>{{ module.academicUnits || '—' }} AU</span><span>Index {{ module.indexNumber || '—' }}</span><span>{{ module.sessions.length }} sessions</span></span><UBadge v-if="moduleIssues(module)" color="warning" variant="soft">{{ moduleIssues(module) }} issue{{ moduleIssues(module) === 1 ? '' : 's' }}</UBadge><UIcon :name="expandedModules.has(module.candidateId) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" /></button></header>
        <div v-show="expandedModules.has(module.candidateId)" class="review-module__body">
        <div class="review-layer-label"><UIcon name="i-lucide-file-input" /><strong>Imported from your timetable</strong><span>Index-specific details remain the source of truth.</span></div>
        <div class="review-fields"><label>Code<input v-model.trim="module.code" maxlength="20"></label><label :id="`review-${module.candidateId}-title`" tabindex="-1">Title<input v-model.trim="module.title" placeholder="Required for a new module" maxlength="160" @input="confirmTitle(module)"><small v-if="module.selected && !module.title">Enter the module title.</small><small v-else-if="module.titleNeedsReview">The imported title appears truncated. Confirm it or use the public suggestion.</small></label><label>AU<input v-model.number="module.academicUnits" type="number" min="0.5" max="30" step="0.5"></label><label>Index number<input v-model.trim="module.indexNumber" maxlength="20"></label><label>Course type<input v-model.trim="module.courseType" maxlength="100"></label><label>Status<select v-model="module.registrationStatus"><option v-for="item in REGISTRATION_STATUSES" :key="item">{{ item }}</option></select></label><label>Exam schedule<input :value="module.examCandidate?.applicable ? module.examCandidate.rawText : 'Not Applicable'" readonly></label></div><p v-if="module.fieldProvenance" class="review-provenance">Fields above were reconstructed from the pasted registered-course table.</p><ul v-if="module.corrections?.length" class="review-corrections"><li v-for="correction in module.corrections" :key="`${correction.original}-${correction.corrected}`">Text read {{ correction.original }}. Corrected to {{ correction.corrected }} using the registered-course table.</li></ul>
        <div :id="`review-${module.candidateId}-publicEnrichment`" class="public-enrichment" tabindex="-1">
          <div class="review-layer-label"><UIcon name="i-lucide-landmark" /><strong>Found in NTU public information</strong><span>Suggestions only; never a replacement for your selected index.</span></div>
          <p v-if="enrichmentLoading.has(module.candidateId)" role="status">Checking public NTU course information…</p>
          <template v-else-if="enrichments[module.candidateId]?.available"><p><strong>{{ enrichments[module.candidateId].title || 'Title not listed' }}</strong><span>{{ enrichments[module.candidateId].academicUnits ? ` · ${enrichments[module.candidateId].academicUnits} AU` : '' }}</span></p><p v-if="enrichments[module.candidateId].school"><strong>School:</strong> {{ enrichments[module.candidateId].school }}</p><p v-if="enrichments[module.candidateId].description">{{ enrichments[module.candidateId].description }}</p><p v-if="enrichments[module.candidateId].gradingBasis"><strong>Grading basis:</strong> {{ enrichments[module.candidateId].gradingBasis }}</p><p>{{ enrichments[module.candidateId].message }}</p><p v-if="enrichments[module.candidateId].indexValidation?.status === 'MATCH'"><strong>Registered index {{ module.indexNumber }} matched the selected public semester.</strong></p><p v-else-if="enrichments[module.candidateId].indexValidation?.status === 'NOT_FOUND'">{{ enrichments[module.candidateId].indexValidation.message }}</p><a :href="enrichments[module.candidateId].officialUrl" target="_blank" rel="noopener">View public source</a><div v-if="enrichments[module.candidateId].verificationStatus === 'PUBLIC_SOURCE_CONFLICT' && (!module.publicEnrichmentConfirmed || module.titleNeedsReview)" class="enrichment-actions"><UButton size="sm" @click="applyEnrichment(module, true)">Use public suggestion</UButton><UButton size="sm" color="neutral" variant="outline" @click="keepImportedDetails(module)">Keep imported details</UButton></div></template>
          <template v-else-if="enrichments[module.candidateId]"><p>{{ enrichments[module.candidateId].reason }}</p><UButton v-if="!module.publicEnrichmentConfirmed" size="sm" color="neutral" variant="outline" @click="module.publicEnrichmentConfirmed = true">Keep this unmatched code</UButton></template>
        </div>
        <div class="review-sessions">
          <div class="review-layer-label"><UIcon name="i-lucide-calendar-clock" /><strong>Timetable sessions</strong><span>Matching class details are grouped; every week and venue variant remains separate.</span></div>
          <article v-for="group in groupedSessions(module)" :key="group.key" class="session-group">
            <header class="session-group__header"><div><strong>{{ group.classType }} · {{ group.groupLabel }}</strong><span>{{ group.dayOfWeek || 'Day missing' }} · {{ formatMinutes(group.startMinutes) || 'Start missing' }}–{{ formatMinutes(group.endMinutes) || 'End missing' }}</span></div><UBadge color="neutral" variant="soft">{{ group.sessions.length }} rule{{ group.sessions.length === 1 ? '' : 's' }}</UBadge></header>
            <div class="session-variants">
              <details v-for="session in group.sessions" :key="session.candidateId" :open="expandedSessions.has(session.candidateId)" class="session-variant" :class="{ 'needs-attention': sessionIssues(session).length }" @toggle="trackSessionToggle(session.candidateId, $event)">
                <summary><label @click.stop><input v-model="session.selected" type="checkbox"> Include</label><span>{{ variantSummary(session) }}</span><UBadge v-if="sessionIssues(session).length" color="warning" variant="soft">{{ sessionIssues(session).length }}</UBadge><UIcon name="i-lucide-chevron-down" /></summary>
                <div :id="`review-${session.candidateId}-conflict`" class="review-fields" tabindex="-1"><label>Module<select :id="`review-${session.candidateId}-moduleCode`" :value="module.candidateId" @change="moveSession(module, session, $event.target.value)"><option v-for="target in modules" :key="target.candidateId" :value="target.candidateId">{{ target.code }}</option></select></label><label>Class type<select v-model="session.classType" @change="markManual(session, 'classType')"><option v-for="item in CLASS_SESSION_TYPES" :key="item">{{ item }}</option></select></label><label>Group<input v-model.trim="session.groupLabel" @input="markManual(session, 'groupLabel')"></label><label>Day<select :id="`review-${session.candidateId}-dayOfWeek`" v-model="session.dayOfWeek" @change="markManual(session, 'dayOfWeek')"><option :value="null">Choose day</option><option v-for="item in DAYS_OF_WEEK" :key="item">{{ item }}</option></select></label><label>Start<input :id="`review-${session.candidateId}-startMinutes`" type="time" :value="timeValue(session, 'startMinutes')" @input="setTime(session, 'startMinutes', $event)"></label><label>End<input :id="`review-${session.candidateId}-endMinutes`" type="time" :value="timeValue(session, 'endMinutes')" @input="setTime(session, 'endMinutes', $event)"></label><label>Venue<input v-model.trim="session.venue" maxlength="200" @input="markManual(session, 'venue')"></label><label>Delivery mode<span class="delivery-control"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /><select :id="`review-${session.candidateId}-deliveryMode`" :value="session.deliveryMode" @change="setDeliveryMode(session, $event.target.value)"><option v-for="item in SESSION_DELIVERY_MODES" :key="item" :value="item">{{ deliveryModeLabel(item) }}</option></select></span></label><label>Recurrence<select :id="`review-${session.candidateId}-recurrence`" :value="session.recurrence" @change="setRecurrence(session, $event.target.value)"><option v-for="item in SESSION_RECURRENCES" :key="item">{{ item }}</option></select></label><label v-if="session.recurrence === 'CUSTOM'">Teaching weeks<input :value="session.weekNumbers.join(', ')" placeholder="2, 3, 4" @input="setWeeks(session, $event)"></label></div>
                <p v-if="session.blockId" class="review-provenance">Physical block {{ session.blockId }} · {{ Object.entries(session.fieldSources || {}).map(([field, source]) => `${field}: ${source.toLowerCase()}`).join(' · ') }}</p>
                <div v-if="session.timeConfirmed === false && session.timeAlternatives?.length" class="enrichment-actions"><UButton v-for="alternative in session.timeAlternatives" :key="`${alternative.source}-${alternative.startMinutes}-${alternative.endMinutes}`" size="sm" :color="alternative.source === 'EXPLICIT_TEXT' ? 'primary' : 'neutral'" :variant="alternative.source === 'EXPLICIT_TEXT' ? 'solid' : 'outline'" @click="chooseTime(session, alternative)">{{ alternative.label || `Use ${alternative.source.toLowerCase().replaceAll('_', ' ')}` }}</UButton></div><label v-if="session.deliveryMode === 'UNKNOWN' && !session.deliveryModeConfirmed" class="review-confirm"><input v-model="session.deliveryModeConfirmed" type="checkbox"> Confirm unknown delivery mode</label><label v-if="session.recurrence === 'WEEKLY' && !session.recurrenceConfirmed" class="review-confirm"><input v-model="session.recurrenceConfirmed" type="checkbox"> Confirm this class occurs every teaching week</label><ul v-if="session.warnings.length"><li v-for="warning in session.warnings" :key="warning">{{ warning }}</li></ul>
              </details>
            </div>
          </article>
          <p v-if="!module.sessions.length">No sessions detected. You can add them manually after confirmation.</p>
        </div>
        </div>
      </section>
      <section v-if="unmatchedText.length" class="dossier-section"><div class="dossier-section__heading"><div><p>Review only</p><h2>Unmatched timetable text</h2></div><UBadge color="warning">{{ unmatchedText.length }}</UBadge></div><p>These text blocks were not allowed to create module cards.</p><article v-for="item in unmatchedText" :key="item.candidateId" class="unmatched-block"><textarea v-model="item.text" rows="2" /><select v-model="item.attachToCandidateId"><option :value="null">Choose a registered module</option><option v-for="module in modules" :key="module.candidateId" :value="module.candidateId">{{ module.code }}</option></select><div class="enrichment-actions"><UButton size="sm" :disabled="!item.attachToCandidateId" @click="attachUnmatched(item)">Attach manually</UButton><UButton size="sm" color="neutral" variant="ghost" @click="unmatchedText = unmatchedText.filter(value => value.candidateId !== item.candidateId)">Ignore</UButton></div></article></section>
      <details class="review-preview"><summary><h2>Weekly preview</h2><span>{{ selectedSessions.length }} selected rules · {{ conflicts.length }} conflicts</span><UIcon name="i-lucide-chevron-down" /></summary><p v-if="!selectedSessions.length">No complete sessions to preview.</p><ol><li v-for="session in selectedSessions" :key="session.candidateId"><strong>{{ session.code }}</strong> {{ session.dayOfWeek || 'Day missing' }} · {{ formatMinutes(session.startMinutes) || 'Start missing' }}–{{ formatMinutes(session.endMinutes) || 'End missing' }} · <span class="delivery-label"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /> {{ deliveryModeLabel(session.deliveryMode) }}</span> · {{ session.recurrence === 'CUSTOM' ? `Weeks ${session.weekNumbers.join(', ')}` : session.recurrence }}</li></ol><div v-if="conflicts.length" class="module-alert"><strong>{{ conflicts.length }} overlapping session pair{{ conflicts.length === 1 ? '' : 's' }} found.</strong><ol><li v-for="pair in conflicts" :key="`${pair.first.candidateId}-${pair.second.candidateId}`"><strong>{{ pair.first.code }}</strong> {{ pair.first.dayOfWeek }} {{ formatMinutes(pair.first.startMinutes) }}–{{ formatMinutes(pair.first.endMinutes) }} conflicts with <strong>{{ pair.second.code }}</strong> {{ formatMinutes(pair.second.startMinutes) }}–{{ formatMinutes(pair.second.endMinutes) }} · {{ conflictWeeks(pair.first, pair.second) }}</li></ol></div></details>
      <p v-if="Object.keys(fieldErrors).length" class="module-alert">Some reviewed fields are invalid. Check highlighted or missing information.</p>
      <footer class="review-actions"><div class="review-actions__status"><span><strong>{{ selectedModuleCount }}</strong> modules</span><span><strong>{{ selectedSessions.length }}</strong> session rules</span><span :class="{ 'has-issues': needsAttention }"><strong>{{ needsAttention }}</strong> unresolved</span><span v-if="draft.semesterMatchStatus !== 'MATCH'" class="semester-block"><UIcon name="i-lucide-triangle-alert" /> Semester {{ draft.semesterMatchStatus.toLowerCase() }}</span></div><div class="review-actions__buttons"><UButton color="neutral" variant="ghost" @click="cancel">Cancel</UButton><UButton color="neutral" variant="outline" :loading="saving" @click="saveReview">Save draft</UButton><UButton :disabled="!canConfirm" :loading="saving" @click="confirm">Confirm</UButton></div></footer>
    </template>
  </main>
</template>
