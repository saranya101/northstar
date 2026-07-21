<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Add opportunity · Northstar' })
const { create, updateStatus, parseText, parseLink, saving, extracting, error, fieldErrors, duplicates, clearErrors } = useOpportunities()
const tab = ref('manual')
const paste = ref('')
const link = ref('')
const extraction = ref(null)
const sourceHost = ref('')
const includeOriginal = ref(false)
const blankForm = sourceType => ({ title: '', organisation: '', category: '', description: null, sourceType, sourceName: null, sourceUrl: null, applicationUrl: null, publishedAt: null, deadline: null, startAt: null, endAt: null, location: null, mode: 'UNKNOWN', commitment: null, eligibilityText: null, requirements: null, benefits: null, tags: [] })
const form = ref(blankForm('MANUAL'))
const confidenceLabel = value => value >= .85 ? 'High confidence' : value >= .6 ? 'Review suggested' : 'Needs review'
function chooseTab(value) { tab.value = value; extraction.value = null; sourceHost.value = ''; clearErrors(); form.value = blankForm(value === 'manual' ? 'MANUAL' : value === 'link' ? 'PASTED_LINK' : 'PASTED_TEXT') }
async function extract() {
  const result = await parseText(paste.value)
  if (!result) return
  extraction.value = result
  const candidate = result.candidate
  form.value = { ...blankForm('PASTED_TEXT'), ...Object.fromEntries(Object.entries(candidate).map(([key, detail]) => [key, detail.value])) }
}
async function extractLink() {
  const result = await parseLink(link.value)
  if (!result) return
  extraction.value = result
  sourceHost.value = result.sourceHost
  form.value = { ...blankForm('PASTED_LINK'), sourceName: result.sourceHost, ...Object.fromEntries(Object.entries(result.candidate).map(([key, detail]) => [key, detail.value])) }
}
async function save(allowDuplicate = false) {
  const result = await create(form.value, allowDuplicate)
  if (!result) return
  if (tab.value === 'paste' && includeOriginal.value && paste.value) await updateStatus(result.id, { notes: paste.value })
  await navigateTo(`/app/opportunities/${result.id}`)
}
const safeSourceUrl = computed(() => /^https?:\/\//i.test(form.value.sourceUrl || '') ? form.value.sourceUrl : null)
</script>

<template>
  <main class="app-page opportunity-new-page">
    <header class="app-page__header"><div><p class="app-page__eyebrow">Opportunity Inbox</p><h1>Add an opportunity</h1><span>Enter the details yourself or extract a reviewable draft from plain text.</span></div></header>
    <div class="opportunity-tabs" role="tablist" aria-label="Entry method"><button type="button" :aria-selected="tab === 'manual'" @click="chooseTab('manual')">Manual entry</button><button type="button" :aria-selected="tab === 'paste'" @click="chooseTab('paste')">Paste text</button><button type="button" :aria-selected="tab === 'link'" @click="chooseTab('link')">Paste link</button></div>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <OpportunitiesOpportunityForm v-if="tab === 'manual'" v-model="form" :errors="fieldErrors" :busy="saving" @submit="save" @cancel="navigateTo('/app/opportunities')" />
    <div v-else class="paste-flow">
      <section v-if="!extraction && tab === 'paste'" class="paste-panel"><div><p>Step 1 of 3</p><h2>Paste an announcement</h2><span>Plain text from an email, message, newsletter or website works best. Nothing is saved during extraction.</span></div><label><span>Announcement text</span><UTextarea v-model="paste" :rows="14" maxlength="20000" placeholder="Paste the opportunity announcement here…" /></label><small>{{ paste.length.toLocaleString() }} / 20,000</small><UButton :loading="saving" :disabled="paste.trim().length < 20" @click="extract">Extract details</UButton></section>
      <section v-else-if="!extraction" class="paste-panel link-import-panel"><div><p>Step 1 of 3</p><h2>Import a public webpage</h2><span>Northstar reads public HTML and structured metadata without running page scripts or saving automatically.</span></div><label><span>Public opportunity URL</span><UInput v-model="link" type="url" inputmode="url" placeholder="https://example.org/opportunity" autocomplete="off" /></label><UButton :loading="extracting" :disabled="extracting || !/^https?:\/\//i.test(link.trim())" @click="extractLink">Extract from link</UButton></section>
      <template v-else>
        <section class="extraction-review"><div><p>Step 2 of 3</p><h2>Review extracted fields</h2><span>Ambiguous values stay blank. Check every field before saving.</span></div><div v-if="sourceHost" class="extraction-source"><span>Imported from <strong>{{ sourceHost }}</strong></span><a v-if="safeSourceUrl" :href="safeSourceUrl" target="_blank" rel="noopener noreferrer">Open source <UIcon name="i-lucide-external-link" /></a></div><ul v-if="extraction.warnings.length"><li v-for="warning in extraction.warnings" :key="warning">{{ warning }}</li></ul><div class="extraction-confidence"><span v-for="(detail, key) in extraction.candidate" :key="key" :class="{ uncertain: detail.confidence < .6 }"><strong>{{ key }}</strong>{{ confidenceLabel(detail.confidence) }}<small v-for="warning in detail.warnings" :key="warning">{{ warning }}</small></span></div></section>
        <section v-if="duplicates.length" class="duplicate-warning" role="alert"><div><p>Possible duplicate</p><h2>You already saved this link</h2><span>Open the existing opportunity, or explicitly save this review as a separate record.</span></div><NuxtLink v-for="item in duplicates" :key="item.id" :to="`/app/opportunities/${item.id}`">{{ item.title }} · {{ item.organisation }} <UIcon name="i-lucide-arrow-right" /></NuxtLink><UButton color="warning" variant="soft" :loading="saving" @click="save(true)">Save as separate opportunity</UButton></section>
        <OpportunitiesOpportunityForm v-model="form" :errors="fieldErrors" :busy="saving" submit-label="Confirm and save" @submit="save(false)" @cancel="extraction = null" />
        <label v-if="tab === 'paste'" class="include-original"><input v-model="includeOriginal" type="checkbox"><span>Include the original pasted text in my private notes</span></label>
      </template>
    </div>
  </main>
</template>
