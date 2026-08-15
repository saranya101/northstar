<script setup>
import { OPPORTUNITY_CATEGORIES } from '#shared/schemas/opportunities'

const { records, view, loading, saving, error, fieldErrors, notice, load, create, preview, createBatch, decide } = useMailIntakes()
const subject = ref('')
const rawText = ref('')
const batchPreview = ref(null)
const segmentDrafts = ref([])
const editingId = ref(null)
const drafts = reactive({})
const label = value => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const opportunity = intake => intake.extractedPayload?.opportunity || {}
const admin = intake => intake.extractedPayload?.admin || {}
const unresolved = intake => intake.extractedPayload?.unresolved || []

function draft(intake) {
  if (!drafts[intake.id]) drafts[intake.id] = Object.fromEntries(Object.entries(opportunity(intake)).map(([key, value]) => [key, value ?? '']))
  return drafts[intake.id]
}
async function submit() {
  const input = { subject: subject.value || undefined, rawText: rawText.value }
  const result = await preview(input)
  if (!result) return
  if (!result.requiresBoundaryReview && result.segments.length === 1) {
    const created = await create({ ...input, rawText: result.segments[0].rawText })
    if (created) resetComposer()
    return
  }
  batchPreview.value = result
  segmentDrafts.value = result.segments.map(segment => ({ ...segment, rawText: segment.rawText }))
}
function resetComposer() {
  subject.value = ''
  rawText.value = ''
  batchPreview.value = null
  segmentDrafts.value = []
}
function removeSegment(index) {
  segmentDrafts.value.splice(index, 1)
  if (!segmentDrafts.value.length) resetComposer()
}
function mergePrevious(index) {
  if (index < 1) return
  segmentDrafts.value[index - 1] = {
    ...segmentDrafts.value[index - 1],
    rawText: `${segmentDrafts.value[index - 1].rawText}\n\n${segmentDrafts.value[index].rawText}`,
    manuallyChanged: true
  }
  segmentDrafts.value.splice(index, 1)
}
function addSegment() {
  segmentDrafts.value.push({ id: `manual-${Date.now()}`, rawText: '', subject: null, classification: { category: 'UNCERTAIN' }, manuallyChanged: true, boundarySignals: ['manual boundary'] })
}
function proceedAsOne() {
  segmentDrafts.value = [{ id: 'manual-combined', rawText: segmentDrafts.value.map(item => item.rawText.trim()).filter(Boolean).join('\n\n'), subject: null, classification: { category: 'UNCERTAIN' }, manuallyChanged: true, boundarySignals: ['deliberate combined review'] }]
}
async function processSegments(indices = segmentDrafts.value.map((_, index) => index)) {
  const chosen = indices.map(index => segmentDrafts.value[index]).filter(item => item?.rawText.trim().length >= 20)
  if (!chosen.length) return
  const result = await createBatch(chosen.map(item => ({ rawText: item.rawText })))
  if (!result) return
  if (indices.length === segmentDrafts.value.length) resetComposer()
  else removeSegment(indices[0])
}
async function saveOpportunity(intake) {
  const values = draft(intake)
  await decide(intake, 'opportunity', { opportunity: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? undefined : value])) })
  editingId.value = null
}
onMounted(load)
</script>

<template>
  <section class="v2-panel mail-intake" aria-labelledby="mail-intake-title">
    <div class="v2-section-heading"><div><p>NTU Mail Intelligence</p><h2 id="mail-intake-title">Paste NTU email</h2></div><span>Manual paste · deterministic · private</span></div>
    <div class="mail-composer">
      <input v-model="subject" maxlength="300" placeholder="Subject (optional — detected from pasted headers when present)" aria-label="Email subject" />
      <textarea v-model="rawText" rows="6" maxlength="50000" placeholder="Paste the email body or forwarded plain text…" aria-label="Pasted NTU email" />
      <small v-if="fieldErrors.rawText">{{ fieldErrors.rawText }}</small>
      <div class="v2-inline-actions"><span>{{ rawText.length.toLocaleString() }} / 50,000</span><UButton :disabled="rawText.trim().length < 20" :loading="saving" icon="i-lucide-mail-plus" @click="submit">Structure for review</UButton></div>
    </div>
    <section v-if="batchPreview" class="mail-boundary-review" aria-labelledby="mail-boundary-title">
      <header><div><strong id="mail-boundary-title">{{ segmentDrafts.length }} {{ segmentDrafts.length === 1 ? 'email' : 'emails' }} detected</strong><span>Review the boundaries before any intake is created.</span></div><UBadge :color="batchPreview.ambiguous ? 'warning' : 'neutral'" variant="outline">{{ batchPreview.ambiguous ? 'Multiple emails may be present' : 'Boundary review' }}</UBadge></header>
      <article v-for="(segment, index) in segmentDrafts" :key="segment.id" class="mail-segment">
        <div class="mail-segment-summary"><div><small>Email {{ index + 1 }}</small><strong>{{ segment.subject || 'No detected subject' }}</strong><span>{{ segment.manuallyChanged ? 'Will be re-evaluated when processed' : label(segment.classification?.category) }}</span></div><div class="v2-inline-actions"><UButton v-if="index" size="xs" color="neutral" variant="ghost" @click="mergePrevious(index)">Merge with previous</UButton><UButton size="xs" color="neutral" variant="ghost" @click="removeSegment(index)">Dismiss</UButton></div></div>
        <details><summary>Review or manually adjust this split</summary><textarea v-model="segment.rawText" rows="7" maxlength="50000" aria-label="Proposed email segment" @input="segment.manuallyChanged = true" /><small>Signals: {{ segment.boundarySignals?.join(', ') || 'manual boundary' }}</small></details>
        <UButton size="xs" color="neutral" variant="outline" :disabled="segment.rawText.trim().length < 20" :loading="saving" @click="processSegments([index])">Process this email</UButton>
      </article>
      <div class="v2-inline-actions mail-boundary-actions"><UButton size="sm" :loading="saving" :disabled="!segmentDrafts.some(item => item.rawText.trim().length >= 20)" @click="processSegments()">Process all</UButton><UButton size="sm" color="neutral" variant="outline" @click="addSegment">Add manual split</UButton><UButton v-if="segmentDrafts.length > 1" size="sm" color="neutral" variant="ghost" @click="proceedAsOne">Deliberately proceed as one</UButton></div>
    </section>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <p v-if="notice" class="mail-notice" role="status">{{ notice }}</p>
    <nav class="mail-filters" aria-label="Mail review status"><button v-for="item in ['active','archived','dismissed']" :key="item" type="button" :class="{ active: view === item }" @click="load(item)">{{ label(item) }}</button></nav>
    <p v-if="loading" role="status">Loading pasted mail…</p>
    <div v-else-if="records.length" class="mail-reviews">
      <article v-for="intake in records" :key="intake.id" class="mail-review">
        <header><div><span>{{ intake.senderName || intake.senderEmail || 'Pasted email' }}</span><strong>{{ intake.subject || 'No detected subject' }}</strong></div><div class="mail-badges"><UBadge color="neutral" variant="outline">{{ label(intake.classification) }}</UBadge><UBadge :color="intake.status === 'CONVERTED' ? 'success' : intake.status === 'DISMISSED' ? 'neutral' : 'warning'">{{ label(intake.status) }}</UBadge></div></header>
        <div class="mail-why"><strong>Why Northstar flagged it</strong><ul><li v-for="reason in intake.reasons" :key="reason">{{ reason }}</li></ul><small>{{ label(intake.confidenceBand) }} confidence · deterministic signals</small></div>

        <div v-if="['OPPORTUNITY','EVENT'].includes(intake.classification)" class="mail-extracted">
          <template v-if="editingId === intake.id">
            <label>Title<input v-model="draft(intake).title" maxlength="180" /></label>
            <label>Organisation<input v-model="draft(intake).organisation" maxlength="180" /></label>
            <label>Category<select v-model="draft(intake).category"><option value="">Unresolved</option><option v-for="category in OPPORTUNITY_CATEGORIES" :key="category" :value="category">{{ label(category) }}</option></select></label>
            <label>Deadline<input v-model="draft(intake).deadline" placeholder="ISO date/time or leave unresolved" /></label>
            <label>Application URL<input v-model="draft(intake).applicationUrl" /></label>
          </template>
          <dl v-else><div><dt>Organisation</dt><dd>{{ opportunity(intake).organisation || 'Unresolved' }}</dd></div><div><dt>Category</dt><dd>{{ opportunity(intake).category ? label(opportunity(intake).category) : 'Unresolved' }}</dd></div><div><dt>Deadline</dt><dd>{{ opportunity(intake).deadline ? new Date(opportunity(intake).deadline).toLocaleString() : opportunity(intake).deadlineSourceText || 'Unresolved' }}</dd></div><div><dt>Eligibility</dt><dd>{{ opportunity(intake).eligibilityText || 'Unresolved' }}</dd></div><div><dt>Application</dt><dd><a v-if="opportunity(intake).applicationUrl" :href="opportunity(intake).applicationUrl" target="_blank" rel="noopener noreferrer">Detected link</a><span v-else>Unresolved</span></dd></div></dl>
        </div>

        <div v-if="['ACTION_REQUIRED','ACADEMIC_ADMIN'].includes(intake.classification)" class="mail-extracted"><dl><div><dt>Module</dt><dd>{{ admin(intake).moduleCode || 'Unresolved' }}</dd></div><div><dt>Type</dt><dd>{{ admin(intake).academicSubtype ? label(admin(intake).academicSubtype) : 'Academic notice' }}</dd></div><div><dt>Class date</dt><dd>{{ admin(intake).eventDate || 'Unresolved' }}</dd></div><div><dt>Venue</dt><dd>{{ admin(intake).venue || 'Unresolved' }}</dd></div><div><dt>Action</dt><dd>{{ admin(intake).requiresAction ? admin(intake).actionRequired : 'No explicit action required' }}</dd></div><div><dt>Deadline</dt><dd>{{ admin(intake).exactDeadline ? new Date(admin(intake).exactDeadline).toLocaleString() : 'None detected' }}</dd></div></dl><div v-if="admin(intake).resources?.length" class="mail-resources"><strong>Resources</strong><a v-for="resource in admin(intake).resources" :key="`${resource.label}-${resource.url}`" :href="resource.url || undefined" :target="resource.url ? '_blank' : undefined" rel="noopener noreferrer">{{ resource.label }} · {{ label(resource.type) }}</a></div></div>
        <details><summary>Source evidence</summary><pre>{{ intake.rawText }}</pre></details>
        <p v-if="unresolved(intake).length" class="mail-unresolved">Unresolved: {{ unresolved(intake).join(' ') }}</p>
        <div v-if="intake.status === 'NEW'" class="v2-inline-actions mail-actions">
          <template v-if="['OPPORTUNITY','EVENT'].includes(intake.classification)"><UButton size="xs" :loading="saving" @click="saveOpportunity(intake)">Save to Opportunity Radar</UButton><UButton size="xs" color="neutral" variant="outline" @click="editingId = editingId === intake.id ? null : intake.id">{{ editingId === intake.id ? 'Cancel edit' : 'Edit' }}</UButton></template>
          <template v-else-if="['ACTION_REQUIRED','ACADEMIC_ADMIN'].includes(intake.classification)"><UButton size="xs" :loading="saving" @click="decide(intake, 'task')">Create task</UButton><UButton size="xs" color="neutral" variant="outline" :loading="saving" @click="decide(intake, 'note')">Save note</UButton></template>
          <UButton size="xs" color="neutral" variant="outline" :loading="saving" @click="decide(intake, 'archive')">Archive</UButton>
          <UButton size="xs" color="neutral" variant="ghost" :loading="saving" @click="decide(intake, 'dismiss')">Dismiss</UButton>
        </div>
        <div v-else-if="intake.convertedOpportunity" class="mail-linked">Opportunity Radar · {{ intake.convertedOpportunity.title }}</div><div v-else-if="intake.convertedTask" class="mail-linked">Task · {{ intake.convertedTask.title }}</div>
      </article>
    </div>
    <div v-else class="v2-empty"><strong>No {{ view }} NTU emails.</strong><span>{{ view === 'active' ? 'Newly ingested mail requiring review appears here.' : 'Processed mail remains available as history.' }}</span></div>
  </section>
</template>

<style scoped>
.mail-intake{display:grid;gap:14px;margin-bottom:16px}.mail-composer{display:grid;gap:8px}.mail-composer input,.mail-composer textarea,.mail-extracted input,.mail-extracted select,.mail-segment textarea{width:100%;border:1px solid #d8d3ca;border-radius:8px;background:#fff;padding:9px 11px;font:inherit}.mail-composer textarea,.mail-segment textarea{resize:vertical}.mail-notice,.mail-linked{padding:9px 11px;border-radius:8px;background:#eef6ef;color:#285d35;font-size:.78rem}.mail-filters{display:flex;gap:4px;border-bottom:1px solid #ebe7df}.mail-filters button{border:0;border-bottom:2px solid transparent;padding:7px 10px;background:transparent;color:var(--v2-muted);font:inherit;font-size:.76rem;cursor:pointer}.mail-filters button.active{border-color:#194f3b;color:#194f3b;font-weight:700}.mail-boundary-review{display:grid;gap:10px;padding:12px;border:1px solid #dfc989;border-radius:9px;background:#fffaf0}.mail-boundary-review>header,.mail-segment-summary{display:flex;justify-content:space-between;gap:12px}.mail-boundary-review>header>div,.mail-segment-summary>div:first-child{display:grid;gap:2px}.mail-boundary-review header span,.mail-segment-summary small,.mail-segment-summary span,.mail-segment details small{font-size:.7rem;color:var(--v2-muted)}.mail-segment{display:grid;gap:8px;padding:10px;border:1px solid #ebe1c7;border-radius:8px;background:#fff}.mail-segment details{display:grid;gap:6px}.mail-segment details[open] summary{margin-bottom:6px}.mail-boundary-actions{justify-content:flex-start}.mail-reviews{display:grid;gap:10px}.mail-review{display:grid;gap:10px;border-top:1px solid #ebe7df;padding-top:14px}.mail-review>header{display:flex;justify-content:space-between;gap:12px}.mail-review>header>div:first-child{display:grid}.mail-review header span,.mail-why small{font-size:.7rem;color:var(--v2-muted)}.mail-badges{display:flex;gap:6px;align-items:start}.mail-why{display:grid;gap:4px}.mail-why ul{margin:0;padding-left:18px;font-size:.78rem}.mail-extracted dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}.mail-extracted dl div,.mail-extracted label{display:grid;gap:3px}.mail-extracted dt,.mail-extracted label{font-size:.68rem;color:var(--v2-muted)}.mail-extracted dd{margin:0;font-size:.78rem}.mail-extracted{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border:1px solid #ebe7df;border-radius:8px}.mail-extracted dl{grid-column:1/-1}.mail-resources{grid-column:1/-1;display:grid;gap:3px;font-size:.72rem}.mail-resources a{color:#194f3b;text-decoration:none}.mail-review details{font-size:.72rem}.mail-review pre{white-space:pre-wrap;max-height:180px;overflow:auto;padding:10px;background:#f7f5f1;border-radius:6px}.mail-unresolved{font-size:.72rem;color:var(--v2-muted)}.mail-actions{justify-content:flex-start}@media(max-width:700px){.mail-review>header,.mail-boundary-review>header,.mail-segment-summary{display:grid}.mail-extracted,.mail-extracted dl{grid-template-columns:1fr}}
</style>
