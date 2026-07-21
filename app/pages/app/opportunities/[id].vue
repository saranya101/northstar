<script setup>
import { USER_OPPORTUNITY_STATUSES } from '~~/shared/schemas/opportunities'
import { OPPORTUNITY_CATEGORY_LABELS, OPPORTUNITY_STATUS_LABELS, opportunityTiming } from '~~/shared/utils/opportunities'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
const route = useRoute()
const { details, loading, saving, error, fieldErrors, loadOne, update, updateStatus, remove } = useOpportunities()
const opportunity = computed(() => details.value[route.params.id])
const timing = computed(() => opportunity.value ? opportunityTiming(opportunity.value) : null)
const editing = ref(false)
const editForm = ref(null)
const personal = reactive({ status: 'SAVED', personalDeadline: null, notes: null })
function localInputValue(value) { if (!value) return ''; const date = new Date(value); const part = number => String(number).padStart(2, '0'); return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}` }
function sync(record) { if (!record) return; personal.status = record.personal?.status || 'SAVED'; personal.personalDeadline = localInputValue(record.personal?.personalDeadline); personal.notes = record.personal?.notes }
onMounted(async () => sync(await loadOne(route.params.id, true)))
watch(opportunity, sync)
function beginEdit() { editForm.value = { ...opportunity.value, personal: undefined, id: undefined, isOwner: undefined, createdByUserId: undefined, createdAt: undefined, updatedAt: undefined }; delete editForm.value.personal; editing.value = true }
async function saveEdit() { const result = await update(route.params.id, editForm.value); if (result) editing.value = false }
async function savePersonal() { await updateStatus(route.params.id, { ...personal, personalDeadline: personal.personalDeadline ? new Date(personal.personalDeadline).toISOString() : null }) }
async function deleteCurrent() { if (!window.confirm('Delete this opportunity permanently?')) return; if (await remove(route.params.id)) await navigateTo('/app/opportunities') }
</script>

<template>
  <main class="app-page opportunity-detail-page">
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <div v-if="loading && !opportunity" class="app-skeleton opportunity-detail-skeleton"><span v-for="item in 8" :key="item" /></div>
    <template v-else-if="opportunity">
      <OpportunitiesOpportunityForm v-if="editing" v-model="editForm" :errors="fieldErrors" :busy="saving" submit-label="Save changes" @submit="saveEdit" @cancel="editing = false" />
      <template v-else>
        <header class="opportunity-detail__header"><div><div class="opportunity-detail__badges"><UBadge color="neutral">{{ OPPORTUNITY_CATEGORY_LABELS[opportunity.category] }}</UBadge><span :class="`deadline-state deadline-state--${timing.state}`">{{ timing.label }}</span></div><h1>{{ opportunity.title }}</h1><p>{{ opportunity.organisation }}</p></div><div v-if="opportunity.isOwner" class="header-actions"><UButton color="neutral" variant="outline" icon="i-lucide-pencil" @click="beginEdit">Edit</UButton><UButton color="error" variant="soft" icon="i-lucide-trash-2" @click="deleteCurrent">Delete</UButton></div></header>
        <div class="opportunity-detail__layout"><article class="opportunity-detail__content">
          <section v-if="opportunity.description"><h2>About</h2><p>{{ opportunity.description }}</p></section>
          <section><h2>Details</h2><dl class="opportunity-detail__facts"><div><dt>Deadline</dt><dd>{{ opportunity.deadline ? new Date(opportunity.deadline).toLocaleString() : 'No deadline' }}</dd></div><div><dt>Dates</dt><dd>{{ opportunity.startAt ? new Date(opportunity.startAt).toLocaleString() : 'Not provided' }}<template v-if="opportunity.endAt"> – {{ new Date(opportunity.endAt).toLocaleString() }}</template></dd></div><div><dt>Location</dt><dd>{{ opportunity.location || 'Not provided' }}</dd></div><div><dt>Mode</dt><dd>{{ opportunity.mode.replaceAll('_', ' ') }}</dd></div><div><dt>Commitment</dt><dd>{{ opportunity.commitment || 'Not provided' }}</dd></div></dl></section>
          <section v-if="opportunity.eligibilityText"><h2>Eligibility</h2><p>{{ opportunity.eligibilityText }}</p></section><section v-if="opportunity.requirements"><h2>Requirements</h2><p>{{ opportunity.requirements }}</p></section><section v-if="opportunity.benefits"><h2>Benefits</h2><p>{{ opportunity.benefits }}</p></section>
          <div class="opportunity-links"><UButton v-if="opportunity.applicationUrl" :to="opportunity.applicationUrl" target="_blank" trailing-icon="i-lucide-external-link">Open application</UButton><UButton v-if="opportunity.sourceUrl" :to="opportunity.sourceUrl" target="_blank" color="neutral" variant="outline" trailing-icon="i-lucide-external-link">Original source</UButton></div>
        </article><aside class="opportunity-personal"><div><p>Your tracking</p><h2>Application status</h2></div><label><span>Status</span><select v-model="personal.status"><option v-for="status in USER_OPPORTUNITY_STATUSES" :key="status" :value="status">{{ OPPORTUNITY_STATUS_LABELS[status] }}</option></select></label><label><span>Personal deadline</span><input v-model="personal.personalDeadline" type="datetime-local"></label><label><span>Private notes</span><UTextarea v-model="personal.notes" :rows="7" maxlength="5000" /></label><UButton block :loading="saving" @click="savePersonal">Save tracking details</UButton></aside></div>
      </template>
    </template>
  </main>
</template>
