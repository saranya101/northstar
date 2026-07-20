<script setup>
import { profileOnboardingSchema, validationFieldErrors } from '~~/shared/schemas/onboarding'

const props = defineProps({ profile: Object, saving: Boolean, serverError: String, fieldErrors: Object, headingLevel: { type: String, default: 'h1' }, submitLabel: { type: String, default: 'Save and continue' } })
const emit = defineEmits(['back', 'submit'])
const form = reactive({ displayName: props.profile?.displayName || '', timezone: props.profile?.timezone || 'Asia/Singapore' })
const errors = ref({})

function submit() {
  const result = profileOnboardingSchema.safeParse(form)
  errors.value = validationFieldErrors(result)
  if (result.success) emit('submit', result.data)
}
</script>

<template>
  <form class="onboarding-form" novalidate @submit.prevent="submit">
    <header class="onboarding-step-heading"><p>Step 1</p><component :is="headingLevel">Let’s make Northstar yours</component><span>Start with the name and timezone Northstar should use.</span></header>
    <div class="onboarding-field">
      <label for="displayName">Display name</label>
      <input id="displayName" v-model="form.displayName" name="displayName" autocomplete="nickname" :aria-invalid="Boolean(errors.displayName || fieldErrors?.displayName)" aria-describedby="displayName-error">
      <small id="displayName-error">{{ errors.displayName || fieldErrors?.displayName }}</small>
    </div>
    <div class="onboarding-field">
      <label for="timezone">Timezone</label>
      <select id="timezone" v-model="form.timezone" name="timezone" autocomplete="off" :aria-invalid="Boolean(errors.timezone || fieldErrors?.timezone)" aria-describedby="timezone-error">
        <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
        <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (UTC+8)</option>
        <option value="Asia/Hong_Kong">Asia/Hong Kong (UTC+8)</option>
        <option value="UTC">UTC</option>
      </select>
      <small id="timezone-error">{{ errors.timezone || fieldErrors?.timezone }}</small>
    </div>
    <p v-if="serverError" class="onboarding-alert" role="alert" aria-live="polite">{{ serverError }}</p>
    <div class="onboarding-actions"><span /><button type="submit" class="onboarding-primary" :disabled="saving">{{ saving ? 'Saving…' : submitLabel }}</button></div>
  </form>
</template>
