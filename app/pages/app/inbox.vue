<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Academic Inbox · Northstar', description: 'Turn pasted academic updates into reviewable actions.' })
const route = useRoute()
const { state: modulesState, load: loadModules } = useModules()
const { records, loading, saving, error, fieldErrors, load, create, approve, dismiss } = useAcademicIntakes()
const rawText = ref(String(route.query.text || ''))
const moduleEnrolmentId = ref(String(route.query.moduleEnrolmentId || ''))
const modules = computed(() => modulesState.value?.modules || [])
const label = value => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
async function interpret() { const result = await create({ rawText: rawText.value, moduleEnrolmentId: moduleEnrolmentId.value || undefined }); if (result) rawText.value = '' }
onMounted(() => Promise.all([loadModules(), load()]))
</script>

<template>
  <main class="app-page v2-page inbox-page">
    <header class="v2-page-heading"><div><p>Academic Inbox</p><h1>Paste once. Review before anything changes.</h1></div><span>Text is retained as evidence. Interpretation never writes directly to academic records.</span></header>
    <section class="v2-intake-composer" aria-labelledby="intake-title">
      <div class="v2-section-heading"><div><p>Text-first intake</p><h2 id="intake-title">What changed?</h2></div><select v-model="moduleEnrolmentId" aria-label="Module context"><option value="">No module selected</option><option v-for="module in modules" :key="module.enrolmentId" :value="module.enrolmentId">{{ module.code }} · {{ module.title }}</option></select></div>
      <textarea v-model="rawText" rows="7" maxlength="30000" placeholder="Paste an announcement, course update, assignment instruction, assessment information or anything from NTULearn…" />
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p><small v-if="fieldErrors.rawText">{{ fieldErrors.rawText }}</small>
      <div class="v2-inline-actions"><span>{{ rawText.length.toLocaleString() }} / 30,000</span><UButton :disabled="rawText.trim().length < 10" :loading="saving" icon="i-lucide-sparkles" @click="interpret">Structure for review</UButton></div>
    </section>
    <section class="v2-panel" aria-labelledby="intake-history-title"><div class="v2-section-heading"><div><p>Review queue</p><h2 id="intake-history-title">Recent intake</h2></div><span>{{ records.length }} saved</span></div>
      <p v-if="loading" role="status">Loading intake…</p><div v-else-if="!records.length" class="v2-empty"><strong>No pasted updates yet.</strong><span>Paste real academic text above; Northstar will retain it even if interpretation needs clarification.</span></div>
      <div v-else class="v2-intake-list"><article v-for="intake in records" :key="intake.id"><header><div><span>{{ intake.moduleEnrolment?.offering?.module?.code || 'General' }} · {{ label(intake.detectedCategory) }}</span><strong>{{ new Date(intake.createdAt).toLocaleString() }}</strong></div><UBadge :color="intake.status === 'APPLIED' ? 'success' : intake.status === 'NEEDS_CLARIFICATION' ? 'warning' : 'neutral'">{{ label(intake.status) }}</UBadge></header><p>{{ intake.rawText }}</p><div v-if="intake.clarificationReason" class="v2-clarification"><UIcon name="i-lucide-triangle-alert" />{{ intake.clarificationReason }}</div><ul><li v-for="proposal in intake.proposals" :key="proposal.id"><div><strong>{{ label(proposal.actionType) }}</strong><span>{{ proposal.payload.title || proposal.payload.name || label(proposal.targetType) }}</span><small v-if="proposal.payload.teachingWeek">Week {{ proposal.payload.teachingWeek }} retained as an academic-week reference.</small><small v-if="proposal.conflictReason">{{ proposal.conflictReason }}</small></div><UBadge color="neutral" variant="outline">{{ label(proposal.status) }}</UBadge><div v-if="['PENDING','CONFLICT'].includes(proposal.status)" class="v2-inline-actions"><UButton v-if="proposal.status === 'PENDING' && intake.status !== 'NEEDS_CLARIFICATION'" size="xs" :loading="saving" @click="approve(intake, proposal)">Approve</UButton><UButton size="xs" color="neutral" variant="ghost" :loading="saving" @click="dismiss(intake, proposal)">Dismiss</UButton></div></li></ul></article></div>
    </section>
  </main>
</template>
