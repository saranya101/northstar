<script setup>
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, REGISTRATION_STATUSES, SESSION_DELIVERY_MODES, SESSION_RECURRENCES } from '~~/shared/schemas/timetable'
import { deliveryModeIcon, deliveryModeLabel } from '~/utils/timetable-import/timetable-delivery'
import { parseNtuSessionBlock } from '~/utils/timetable-import/ntu-session-block-parser'
import { applyPublicEnrichmentSuggestion, canConfirmReview, cloneReviewModules, compactSessionParts, groupReviewSessions, initialExpandedModuleIds, initialExpandedSessionIds, moduleIssueCount, revealReviewIssue, reviewIssues, sessionIssueFields } from '~/utils/timetable-import/timetable-review'
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
const attemptedEnrichment = new Set()
const unmatchedText = ref([])
const expandedModules = reactive(new Set())
const expandedSessions = reactive(new Set())
const selectedSessions = computed(() => modules.value.filter(module => module.selected).flatMap(module => module.sessions.filter(session => session.selected).map(session => ({ ...session, code: module.code }))))
const attentionItems = computed(() => {
  const items = reviewIssues(modules.value, draft.value)
  if (draft.value?.semesterMatchStatus === 'MATCH') return items
  return [{
    id: 'semester-status', moduleCandidateId: null, sessionCandidateId: null, field: 'semester',
    label: draft.value?.semesterMatchStatus === 'MISMATCH' ? 'Choose the matching semester' : 'Select the timetable semester',
    context: draft.value?.sourceSemester?.displayLabel || 'Semester not detected', targetId: 'review-semester'
  }, ...items]
})
const needsAttention = computed(() => attentionItems.value.length)
const canConfirm = computed(() => canConfirmReview(modules.value, needsAttention.value, draft.value?.semesterMatchStatus))
const totalAcademicUnits = computed(() => modules.value.filter(module => module.selected).reduce((sum, module) => sum + (Number(module.academicUnits) || 0), 0))
const sessionRuleCount = computed(() => selectedSessions.value.length)
const selectedModuleCount = computed(() => modules.value.filter(module => module.selected).length)

function loadDraft(value) {
  modules.value = cloneReviewModules(value.modules)
  unmatchedText.value = cloneReviewModules(value.unmatchedTimetableText)
  expandedModules.clear(); initialExpandedModuleIds(modules.value, value).forEach(id => expandedModules.add(id))
  expandedSessions.clear(); initialExpandedSessionIds(modules.value, value).forEach(id => expandedSessions.add(id))
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
function sessionSummary(session) { return compactSessionParts(session) }
function enumLabel(value) { return String(value || '').toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase()) }
async function navigateToIssue(issue) {
  const targetId = issue.moduleCandidateId ? revealReviewIssue(expandedModules, expandedSessions, issue) : issue.targetId
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
  const value = await enrichModule({ code: module.code, academicYear: term.academicYear, semester: term.name, indexNumber: module.indexNumber, importedTitle: module.title })
  enrichments[module.candidateId] = value
  if (value.available && value.verificationStatus === 'PUBLIC_SOURCE_MATCH') applyEnrichment(module, true)
  else if (value.verificationStatus === 'PUBLIC_SOURCE_CONFLICT') { module.publicEnrichmentConfirmed = false; expandedModules.add(module.candidateId) }
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
      <header id="review-semester" class="review-hero" tabindex="-1">
        <div class="review-hero__heading">
          <div><p class="app-page__eyebrow">Timetable import</p><h1>Review timetable</h1></div>
          <p class="review-hero__counts"><strong>{{ selectedModuleCount }}</strong> modules <span>·</span> <strong>{{ sessionRuleCount }}</strong> classes <span>·</span> <strong>{{ totalAcademicUnits }}</strong> AU</p>
        </div>
        <div class="review-semester-line" :class="`is-${draft.semesterMatchStatus.toLowerCase()}`">
          <div><strong>{{ draft.sourceSemester?.displayLabel || 'Semester not detected' }}</strong><span v-if="draft.semesterMatchStatus === 'MATCH'"><UIcon name="i-lucide-circle-check" /> Matches current semester</span><span v-else-if="draft.semesterMatchStatus === 'MISMATCH'"><UIcon name="i-lucide-triangle-alert" /> Does not match {{ draft.targetSemester?.displayLabel || 'the current semester' }}</span><span v-else><UIcon name="i-lucide-triangle-alert" /> Select a target semester before confirming</span></div>
          <UButton v-if="draft.semesterMatchStatus !== 'MATCH'" to="/app/settings" size="sm" color="neutral" variant="outline">Semester settings</UButton>
        </div>
        <p v-if="!needsAttention" class="review-ready"><UIcon name="i-lucide-check" /> All required timetable information was detected.</p>
      </header>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <section v-if="needsAttention" id="review-structure" class="attention-panel attention-panel--compact" aria-labelledby="attention-heading" tabindex="-1"><div class="attention-panel__heading"><h2 id="attention-heading">Needs attention <span>· {{ needsAttention }}</span></h2></div><ol class="attention-list"><li v-for="item in attentionItems" :key="item.id"><button type="button" @click="navigateToIssue(item)"><strong>{{ item.context }}</strong><span>{{ item.label }}</span><UIcon name="i-lucide-arrow-down-right" /></button></li></ol></section>

      <section class="compact-module-list" aria-label="Detected modules">
      <article v-for="module in modules" :key="module.candidateId" class="review-module compact-module" :class="{ 'is-excluded': !module.selected, 'is-expanded': expandedModules.has(module.candidateId) }">
        <header class="compact-module__summary">
          <div class="compact-module__identity"><strong>{{ module.code || 'Module code missing' }}</strong><span>{{ module.title || 'Title needs review' }}</span></div>
          <span class="compact-module__au">{{ module.academicUnits || '—' }} AU</span>
          <UBadge v-if="moduleIssues(module)" color="warning" variant="soft">{{ moduleIssues(module) }} issue{{ moduleIssues(module) === 1 ? '' : 's' }}</UBadge>
          <button type="button" class="compact-module__edit" :aria-expanded="expandedModules.has(module.candidateId)" @click="toggleModule(module.candidateId)">{{ expandedModules.has(module.candidateId) ? 'Done' : 'Edit' }}</button>
        </header>
        <div class="compact-session-list">
          <div v-for="session in module.sessions" :key="session.candidateId" class="compact-session-row" :class="{ 'needs-attention': sessionIssues(session).length }"><span v-for="part in sessionSummary(session)" :key="part">{{ part }}</span><UBadge v-if="sessionIssues(session).length" color="warning" variant="soft">Review</UBadge></div>
          <p v-if="!module.sessions.length">No classes detected</p>
        </div>
        <div v-show="expandedModules.has(module.candidateId)" class="review-module__body">
        <div class="review-fields review-fields--module"><label class="review-confirm"><input v-model="module.selected" type="checkbox"> Include this module</label><label :id="`review-${module.candidateId}-code`" tabindex="-1">Code<input v-model.trim="module.code" maxlength="20"></label><label :id="`review-${module.candidateId}-title`" tabindex="-1">Title<input v-model.trim="module.title" placeholder="Required for a new module" maxlength="160" @input="confirmTitle(module)"><small v-if="module.selected && !module.title">Enter the module title.</small><small v-else-if="module.titleNeedsReview">Confirm the detected title.</small></label><label>AU<input v-model.number="module.academicUnits" type="number" min="0.5" max="30" step="0.5"></label><label>Index number<input v-model.trim="module.indexNumber" maxlength="20"></label><label>Course type<input v-model.trim="module.courseType" maxlength="100"></label><label>Status<select v-model="module.registrationStatus"><option v-for="item in REGISTRATION_STATUSES" :key="item" :value="item">{{ enumLabel(item) }}</option></select></label></div>
        <div v-if="!module.publicEnrichmentConfirmed" :id="`review-${module.candidateId}-publicEnrichment`" class="public-enrichment" tabindex="-1">
          <strong>Course details need confirmation</strong>
          <template v-if="enrichments[module.candidateId]?.available"><p>{{ enrichments[module.candidateId].message }}</p><div class="enrichment-actions"><UButton size="sm" @click="applyEnrichment(module, true)">Use public suggestion</UButton><UButton size="sm" color="neutral" variant="outline" @click="keepImportedDetails(module)">Keep imported details</UButton></div></template>
          <template v-else><p>The public course listing could not confirm these details.</p><UButton size="sm" color="neutral" variant="outline" @click="module.publicEnrichmentConfirmed = true">Keep imported details</UButton></template>
        </div>
        <div class="review-sessions">
          <div class="review-layer-label"><UIcon name="i-lucide-calendar-clock" /><strong>Class details</strong><span>Open a class only when you need to correct it.</span></div>
          <article v-for="group in groupedSessions(module)" :key="group.key" class="session-group">
            <header class="session-group__header"><div><strong>{{ enumLabel(group.classType) }}<template v-if="group.groupLabel && group.groupLabel !== 'DEFAULT'"> · {{ group.groupLabel }}</template></strong><span>{{ sessionSummary(group.sessions[0]).slice(0, 2).join(' · ') }}</span></div><UBadge color="neutral" variant="soft">{{ group.sessions.length }} class{{ group.sessions.length === 1 ? '' : 'es' }}</UBadge></header>
            <div class="session-variants">
              <details v-for="session in group.sessions" :key="session.candidateId" :open="expandedSessions.has(session.candidateId)" class="session-variant" :class="{ 'needs-attention': sessionIssues(session).length }" @toggle="trackSessionToggle(session.candidateId, $event)">
                <summary><label @click.stop><input v-model="session.selected" type="checkbox"> Include</label><span>{{ sessionSummary(session).join(' · ') }}</span><UBadge v-if="sessionIssues(session).length" color="warning" variant="soft">{{ sessionIssues(session).length }} issue{{ sessionIssues(session).length === 1 ? '' : 's' }}</UBadge><UIcon name="i-lucide-chevron-down" /></summary>
                <div :id="`review-${session.candidateId}-conflict`" class="review-fields" tabindex="-1"><label>Module<select :id="`review-${session.candidateId}-moduleCode`" :value="module.candidateId" @change="moveSession(module, session, $event.target.value)"><option v-for="target in modules" :key="target.candidateId" :value="target.candidateId">{{ target.code }}</option></select></label><label>Class type<select v-model="session.classType" @change="markManual(session, 'classType')"><option v-for="item in CLASS_SESSION_TYPES" :key="item" :value="item">{{ enumLabel(item) }}</option></select></label><label>Group<input v-model.trim="session.groupLabel" @input="markManual(session, 'groupLabel')"></label><label>Day<select :id="`review-${session.candidateId}-dayOfWeek`" v-model="session.dayOfWeek" @change="markManual(session, 'dayOfWeek')"><option :value="null">Choose day</option><option v-for="item in DAYS_OF_WEEK" :key="item" :value="item">{{ enumLabel(item) }}</option></select></label><label>Start<input :id="`review-${session.candidateId}-startMinutes`" type="time" :value="timeValue(session, 'startMinutes')" @input="setTime(session, 'startMinutes', $event)"></label><label>End<input :id="`review-${session.candidateId}-endMinutes`" type="time" :value="timeValue(session, 'endMinutes')" @input="setTime(session, 'endMinutes', $event)"></label><label>Venue<input v-model.trim="session.venue" maxlength="200" @input="markManual(session, 'venue')"></label><label>Delivery mode<span class="delivery-control"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /><select :id="`review-${session.candidateId}-deliveryMode`" :value="session.deliveryMode" @change="setDeliveryMode(session, $event.target.value)"><option v-for="item in SESSION_DELIVERY_MODES" :key="item" :value="item">{{ deliveryModeLabel(item) }}</option></select></span></label><label>Teaching pattern<select :id="`review-${session.candidateId}-recurrence`" :value="session.recurrence" @change="setRecurrence(session, $event.target.value)"><option v-for="item in SESSION_RECURRENCES" :key="item" :value="item">{{ enumLabel(item) }}</option></select></label><label v-if="session.recurrence === 'CUSTOM'">Teaching weeks<input :value="session.weekNumbers.join(', ')" placeholder="2, 3, 4" @input="setWeeks(session, $event)"></label></div>
                <div v-if="session.timeConfirmed === false && session.timeAlternatives?.length" class="enrichment-actions"><UButton v-for="alternative in session.timeAlternatives" :key="`${alternative.source}-${alternative.startMinutes}-${alternative.endMinutes}`" size="sm" :color="alternative.source === 'EXPLICIT_TEXT' ? 'primary' : 'neutral'" :variant="alternative.source === 'EXPLICIT_TEXT' ? 'solid' : 'outline'" @click="chooseTime(session, alternative)">{{ alternative.label || `Use ${alternative.source.toLowerCase().replaceAll('_', ' ')}` }}</UButton></div><label v-if="session.deliveryMode === 'UNKNOWN' && !session.deliveryModeConfirmed" class="review-confirm"><input v-model="session.deliveryModeConfirmed" type="checkbox"> Confirm unknown delivery mode</label><label v-if="session.recurrence === 'WEEKLY' && !session.recurrenceConfirmed" class="review-confirm"><input v-model="session.recurrenceConfirmed" type="checkbox"> Confirm this class occurs every teaching week</label><ul v-if="session.warnings.length"><li v-for="warning in session.warnings" :key="warning">{{ warning }}</li></ul>
              </details>
            </div>
          </article>
          <p v-if="!module.sessions.length">No sessions detected. You can add them manually after confirmation.</p>
        </div>
        </div>
      </article>
      </section>
      <section v-if="unmatchedText.length" class="dossier-section"><div class="dossier-section__heading"><div><p>Review only</p><h2>Unmatched timetable text</h2></div><UBadge color="warning">{{ unmatchedText.length }}</UBadge></div><p>These text blocks were not allowed to create module cards.</p><article v-for="item in unmatchedText" :key="item.candidateId" class="unmatched-block"><textarea v-model="item.text" rows="2" /><select v-model="item.attachToCandidateId"><option :value="null">Choose a registered module</option><option v-for="module in modules" :key="module.candidateId" :value="module.candidateId">{{ module.code }}</option></select><div class="enrichment-actions"><UButton size="sm" :disabled="!item.attachToCandidateId" @click="attachUnmatched(item)">Attach manually</UButton><UButton size="sm" color="neutral" variant="ghost" @click="unmatchedText = unmatchedText.filter(value => value.candidateId !== item.candidateId)">Ignore</UButton></div></article></section>
      <p v-if="Object.keys(fieldErrors).length" class="module-alert">Some reviewed fields are invalid. Check highlighted or missing information.</p>
      <footer class="review-actions"><div class="review-actions__status"><span><strong>{{ selectedModuleCount }}</strong> modules</span><span><strong>{{ sessionRuleCount }}</strong> classes</span><span><strong>{{ totalAcademicUnits }}</strong> AU</span><span :class="{ 'has-issues': needsAttention }"><strong>{{ needsAttention }}</strong> issues</span></div><div class="review-actions__buttons"><UButton color="neutral" variant="ghost" @click="cancel">Cancel</UButton><UButton v-if="needsAttention" color="warning" variant="soft" @click="navigateToIssue(attentionItems[0])">Review issues</UButton><UButton v-else :disabled="!canConfirm" :loading="saving" @click="confirm">Confirm timetable</UButton></div></footer>
    </template>
  </main>
</template>
