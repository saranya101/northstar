<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Add opportunity · Northstar' })
const { create, updateStatus, parseText, saving, error, fieldErrors, clearErrors } = useOpportunities()
const tab = ref('manual')
const paste = ref('')
const extraction = ref(null)
const includeOriginal = ref(false)
const blankForm = sourceType => ({ title: '', organisation: '', category: '', description: null, sourceType, sourceName: null, sourceUrl: null, applicationUrl: null, publishedAt: null, deadline: null, startAt: null, endAt: null, location: null, mode: 'UNKNOWN', commitment: null, eligibilityText: null, requirements: null, benefits: null, tags: [] })
const form = ref(blankForm('MANUAL'))
const confidenceLabel = value => value >= .85 ? 'High confidence' : value >= .6 ? 'Review suggested' : 'Needs review'
function chooseTab(value) { tab.value = value; clearErrors(); if (value === 'manual' && !extraction.value) form.value = blankForm('MANUAL') }
async function extract() {
  const result = await parseText(paste.value)
  if (!result) return
  extraction.value = result
  const candidate = result.candidate
  form.value = { ...blankForm('PASTED_TEXT'), ...Object.fromEntries(Object.entries(candidate).map(([key, detail]) => [key, detail.value])) }
}
async function save() {
  const result = await create(form.value)
  if (!result) return
  if (includeOriginal.value && paste.value) await updateStatus(result.id, { notes: paste.value })
  await navigateTo(`/app/opportunities/${result.id}`)
}
</script>

<template>
  <main class="app-page opportunity-new-page">
    <header class="app-page__header"><div><p class="app-page__eyebrow">Opportunity Inbox</p><h1>Add an opportunity</h1><span>Enter the details yourself or extract a reviewable draft from plain text.</span></div></header>
    <div class="opportunity-tabs" role="tablist" aria-label="Entry method"><button type="button" :aria-selected="tab === 'manual'" @click="chooseTab('manual')">Manual entry</button><button type="button" :aria-selected="tab === 'paste'" @click="chooseTab('paste')">Paste text</button></div>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <OpportunitiesOpportunityForm v-if="tab === 'manual'" v-model="form" :errors="fieldErrors" :busy="saving" @submit="save" @cancel="navigateTo('/app/opportunities')" />
    <div v-else class="paste-flow">
      <section v-if="!extraction" class="paste-panel"><div><p>Step 1 of 3</p><h2>Paste an announcement</h2><span>Plain text from an email, message, newsletter or website works best. Nothing is saved during extraction.</span></div><label><span>Announcement text</span><UTextarea v-model="paste" :rows="14" maxlength="20000" placeholder="Paste the opportunity announcement here…" /></label><small>{{ paste.length.toLocaleString() }} / 20,000</small><UButton :loading="saving" :disabled="paste.trim().length < 20" @click="extract">Extract details</UButton></section>
      <template v-else>
        <section class="extraction-review"><div><p>Step 2 of 3</p><h2>Review extracted fields</h2><span>Ambiguous values stay blank. Check every field before saving.</span></div><ul v-if="extraction.warnings.length"><li v-for="warning in extraction.warnings" :key="warning">{{ warning }}</li></ul><div class="extraction-confidence"><span v-for="(detail, key) in extraction.candidate" :key="key" :class="{ uncertain: detail.confidence < .6 }"><strong>{{ key }}</strong>{{ confidenceLabel(detail.confidence) }}<small v-for="warning in detail.warnings" :key="warning">{{ warning }}</small></span></div></section>
        <OpportunitiesOpportunityForm v-model="form" :errors="fieldErrors" :busy="saving" submit-label="Confirm and save" @submit="save" @cancel="extraction = null" />
        <label class="include-original"><input v-model="includeOriginal" type="checkbox"><span>Include the original pasted text in my private notes</span></label>
      </template>
    </div>
  </main>
</template>
