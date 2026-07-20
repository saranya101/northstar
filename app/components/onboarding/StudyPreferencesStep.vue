<script setup>
import { studyPreferenceSchema, validationFieldErrors } from '~~/shared/schemas/onboarding'

const props = defineProps({ preference: Object, saving: Boolean, serverError: String, fieldErrors: Object, headingLevel: { type: String, default: 'h1' }, submitLabel: { type: String, default: 'Save and continue' }, showBack: { type: Boolean, default: true } })
const emit = defineEmits(['back', 'submit'])
const form = reactive({ preferredStudyPeriod: props.preference?.preferredStudyPeriod || 'FLEXIBLE', typicalSessionMinutes: props.preference?.typicalSessionMinutes || 60, maximumDailyStudyMinutes: props.preference?.maximumDailyStudyMinutes || 240, weekStartsOn: props.preference?.weekStartsOn ?? 1, notificationsEnabled: props.preference?.notificationsEnabled ?? true })
const errors = ref({})
function submit() { const result = studyPreferenceSchema.safeParse(form); errors.value = validationFieldErrors(result); if (result.success) emit('submit', result.data) }
</script>

<template>
  <form class="onboarding-form" novalidate @submit.prevent="submit">
    <header class="onboarding-step-heading"><p>Step 4</p><component :is="headingLevel">How do you work best?</component><span>Set practical planning defaults. You can revise these whenever your routine changes.</span></header>
    <div class="onboarding-field"><label for="preferredStudyPeriod">Preferred study period</label><select id="preferredStudyPeriod" v-model="form.preferredStudyPeriod"><option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option><option value="EVENING">Evening</option><option value="FLEXIBLE">Flexible</option></select><small>{{ errors.preferredStudyPeriod || fieldErrors?.preferredStudyPeriod }}</small></div>
    <div class="onboarding-form__grid">
      <div class="onboarding-field"><label for="typicalSessionMinutes">Typical session (minutes)</label><input id="typicalSessionMinutes" v-model="form.typicalSessionMinutes" type="number" min="15" max="240" step="5" inputmode="numeric"><small>{{ errors.typicalSessionMinutes || fieldErrors?.typicalSessionMinutes }}</small></div>
      <div class="onboarding-field"><label for="maximumDailyStudyMinutes">Daily maximum (minutes)</label><input id="maximumDailyStudyMinutes" v-model="form.maximumDailyStudyMinutes" type="number" min="30" max="960" step="15" inputmode="numeric"><small>{{ errors.maximumDailyStudyMinutes || fieldErrors?.maximumDailyStudyMinutes }}</small></div>
      <div class="onboarding-field"><label for="weekStartsOn">Week starts on</label><select id="weekStartsOn" v-model="form.weekStartsOn"><option :value="1">Monday</option><option :value="0">Sunday</option><option :value="6">Saturday</option></select><small>{{ errors.weekStartsOn || fieldErrors?.weekStartsOn }}</small></div>
    </div>
    <label class="onboarding-toggle"><input v-model="form.notificationsEnabled" type="checkbox"><span><strong>Notifications enabled</strong><small>Allow Northstar to use reminders when they are introduced.</small></span></label>
    <p v-if="serverError" class="onboarding-alert" role="alert" aria-live="polite">{{ serverError }}</p>
    <div class="onboarding-actions"><button v-if="showBack" type="button" class="onboarding-secondary" @click="emit('back')">Back</button><span v-else /><button type="submit" class="onboarding-primary" :disabled="saving">{{ saving ? 'Saving…' : submitLabel }}</button></div>
  </form>
</template>
