<script setup>
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_MODES } from '~~/shared/schemas/opportunities'
import { OPPORTUNITY_CATEGORY_LABELS } from '~~/shared/utils/opportunities'

defineProps({ errors: { type: Object, default: () => ({}) }, submitLabel: { type: String, default: 'Save opportunity' }, busy: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const form = defineModel({ required: true })
function toLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const part = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`
}
function updateDate(key, value) { form.value[key] = value ? new Date(value).toISOString() : null }
</script>

<template>
  <form class="opportunity-form" @submit.prevent="emit('submit')">
    <section><div class="opportunity-form__heading"><p>Essentials</p><h2>What is the opportunity?</h2></div><div class="opportunity-form__grid">
      <label><span>Title *</span><UInput v-model="form.title" required maxlength="180" /><small v-if="errors.title">{{ errors.title }}</small></label>
      <label><span>Organisation *</span><UInput v-model="form.organisation" required maxlength="180" /><small v-if="errors.organisation">{{ errors.organisation }}</small></label>
      <label><span>Category *</span><select v-model="form.category" required><option disabled value="">Select category</option><option v-for="category in OPPORTUNITY_CATEGORIES" :key="category" :value="category">{{ OPPORTUNITY_CATEGORY_LABELS[category] }}</option></select><small v-if="errors.category">{{ errors.category }}</small></label>
      <label><span>Mode</span><select v-model="form.mode"><option v-for="mode in OPPORTUNITY_MODES" :key="mode" :value="mode">{{ mode.replaceAll('_', ' ') }}</option></select></label>
      <label class="span-2"><span>Description</span><UTextarea v-model="form.description" :rows="4" maxlength="5000" /></label>
    </div></section>
    <section><div class="opportunity-form__heading"><p>Timing</p><h2>Dates and place</h2></div><div class="opportunity-form__grid">
      <label><span>Application deadline</span><input type="datetime-local" :value="toLocal(form.deadline)" @input="updateDate('deadline', $event.target.value)"><small v-if="errors.deadline">{{ errors.deadline }}</small></label>
      <label><span>Starts</span><input type="datetime-local" :value="toLocal(form.startAt)" @input="updateDate('startAt', $event.target.value)"></label>
      <label><span>Ends</span><input type="datetime-local" :value="toLocal(form.endAt)" @input="updateDate('endAt', $event.target.value)"><small v-if="errors.endAt">{{ errors.endAt }}</small></label>
      <label><span>Location</span><UInput v-model="form.location" maxlength="240" /></label>
      <label><span>Commitment</span><UInput v-model="form.commitment" maxlength="500" placeholder="e.g. 10 hours per week" /></label>
    </div></section>
    <section><div class="opportunity-form__heading"><p>Links</p><h2>Where did you find it?</h2></div><div class="opportunity-form__grid">
      <label><span>Application URL</span><UInput v-model="form.applicationUrl" type="url" placeholder="https://" /><small v-if="errors.applicationUrl">{{ errors.applicationUrl }}</small></label>
      <label><span>Source URL</span><UInput v-model="form.sourceUrl" type="url" placeholder="https://" /><small v-if="errors.sourceUrl">{{ errors.sourceUrl }}</small></label>
      <label><span>Source name</span><UInput v-model="form.sourceName" maxlength="180" placeholder="Newsletter, website, person…" /></label>
      <label><span>Tags</span><UInput :model-value="form.tags.join(', ')" placeholder="engineering, student" @update:model-value="form.tags = $event.split(',').map(value => value.trim()).filter(Boolean)" /></label>
    </div></section>
    <section><div class="opportunity-form__heading"><p>Fit</p><h2>Review the details</h2></div><div class="opportunity-form__grid">
      <label class="span-2"><span>Eligibility</span><UTextarea v-model="form.eligibilityText" :rows="3" /></label>
      <label class="span-2"><span>Requirements</span><UTextarea v-model="form.requirements" :rows="3" /></label>
      <label class="span-2"><span>Benefits</span><UTextarea v-model="form.benefits" :rows="3" /></label>
    </div></section>
    <p v-if="errors._form" class="module-alert" role="alert">{{ errors._form }}</p>
    <div class="opportunity-form__actions"><UButton type="button" color="neutral" variant="outline" @click="emit('cancel')">Cancel</UButton><UButton type="submit" :loading="busy">{{ submitLabel }}</UButton></div>
  </form>
</template>
