<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
const route = useRoute()
const { reviews, loading, saving, error, loadOne, review } = useCourseDocuments()
const document = computed(() => reviews.value[route.params.id])
const edits = reactive({})

useSeoMeta({ title: () => document.value ? `${document.value.displayTitle} · Document review` : 'Document review · Northstar' })
watch(document, value => {
  if (!value) return
  for (const proposal of value.proposals || []) {
    if (!(proposal.id in edits)) edits[proposal.id] = typeof proposal.proposedValue === 'string' ? proposal.proposedValue : JSON.stringify(proposal.proposedValue, null, 2)
  }
}, { immediate: true })
onMounted(() => void loadOne(route.params.id))

function label(value) { return value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) }
function proposalStatus(proposal) {
  if (proposal.status === 'APPROVED') return 'Confirmed'
  if (proposal.status === 'REJECTED') return 'Rejected'
  if (proposal.classification === 'CONFLICT') return 'Conflict'
  if (proposal.classification === 'FILL_MISSING') return 'Awaiting details'
  return 'Needs review'
}
function display(value) { return value === null || value === undefined || value === '' ? 'TBA' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value) }
function editedValue(proposal) {
  const value = edits[proposal.id]
  if (typeof proposal.proposedValue === 'string') return value
  try { return JSON.parse(value) } catch { return value }
}
async function decide(proposal, action) {
  await review(document.value.id, {
    expectedUpdatedAt: document.value.updatedAt,
    decisions: [{ id: proposal.id, action, ...(action === 'APPROVE' ? { proposedValue: editedValue(proposal) } : {}) }]
  })
}
async function approveSafe() {
  const decisions = document.value.proposals.filter(item => item.status === 'PENDING' && item.classification !== 'CONFLICT').map(item => ({ id: item.id, action: 'APPROVE', proposedValue: editedValue(item) }))
  if (decisions.length) await review(document.value.id, { expectedUpdatedAt: document.value.updatedAt, decisions })
}
</script>

<template>
  <main class="app-page review-page">
    <p v-if="loading && !document" role="status">Loading document review…</p>
    <p v-else-if="!document" class="module-alert" role="alert">{{ error || 'Document review unavailable.' }}</p>
    <template v-else>
      <NuxtLink :to="`/app/modules/${document.userModuleEnrolmentId}#documents`" class="dossier-back"><UIcon name="i-lucide-arrow-left" /> Back to module documents</NuxtLink>
      <header class="review-header"><div><p>{{ label(document.documentType) }}</p><h1>{{ document.displayTitle }}</h1><span>{{ document.originalFileName || 'Pasted text' }} · {{ document.proposalCount }} proposed changes</span></div><UBadge :color="document.status === 'CONFIRMED' ? 'success' : 'neutral'">{{ label(document.status) }}</UBadge></header>
      <div class="module-alert review-privacy"><UIcon name="i-lucide-shield-check" /><span>Original file not retained. Extracted text and evidence remain private to your account.</span></div>
      <section class="dossier-section">
        <div class="dossier-section__heading"><div><p>Source-aware comparison</p><h2>Proposed changes</h2></div><UButton :disabled="!document.proposals.some(item => item.status === 'PENDING' && item.classification !== 'CONFLICT')" :loading="saving" @click="approveSafe">Approve all non-conflicting</UButton></div>
        <p v-if="!document.proposals.length" class="dossier-empty">No changes were extracted from this document.</p>
        <article v-for="proposal in document.proposals" :key="proposal.id" class="document-proposal" :class="`document-proposal--${proposal.classification.toLowerCase()}`">
          <div class="document-proposal__heading"><div><UBadge :color="proposal.classification === 'CONFLICT' ? 'warning' : proposal.status === 'APPROVED' ? 'success' : 'neutral'">{{ label(proposal.classification) }}</UBadge><strong>{{ label(proposal.targetType) }} · {{ label(proposal.fieldName) }}</strong></div><span>{{ proposalStatus(proposal) }}</span></div>
          <div class="document-comparison"><div><small>Current value</small><pre>{{ display(proposal.currentValue) }}</pre></div><div><small>Proposed value</small><UTextarea v-if="proposal.status === 'PENDING'" v-model="edits[proposal.id]" :rows="typeof proposal.proposedValue === 'object' ? 7 : 3" /><pre v-else>{{ display(proposal.proposedValue) }}</pre></div></div>
          <p class="document-evidence-label">Source evidence</p>
          <dl class="candidate-provenance"><div><dt>Confidence</dt><dd>{{ proposal.confidence === null ? 'Not provided' : `${Math.round(proposal.confidence * 100)}%` }}</dd></div><div><dt>Document</dt><dd>{{ document.displayTitle }}</dd></div><div v-if="proposal.pageNumber"><dt>Page</dt><dd>{{ proposal.pageNumber }}</dd></div><div v-if="proposal.sourceExcerpt"><dt>Source excerpt</dt><dd><small>“{{ proposal.sourceExcerpt }}”</small></dd></div></dl>
          <div v-if="proposal.status === 'PENDING'" class="academic-actions"><UButton color="neutral" variant="outline" :loading="saving" @click="decide(proposal, 'REJECT')">Reject</UButton><UButton :color="proposal.classification === 'CONFLICT' ? 'warning' : 'primary'" :loading="saving" @click="decide(proposal, 'APPROVE')">Approve</UButton></div>
        </article>
      </section>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    </template>
  </main>
</template>
