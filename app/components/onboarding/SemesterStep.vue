<script setup>
import { semesterOnboardingSchema, validationFieldErrors } from '~~/shared/schemas/onboarding'

const props = defineProps({ semester: Object, terms: { type: Array, default: () => [] }, saving: Boolean, serverError: String, fieldErrors: Object, headingLevel: { type: String, default: 'h1' }, submitLabel: { type: String, default: 'Save and continue' }, showBack: { type: Boolean, default: true } })
const emit = defineEmits(['back', 'submit'])
const savedTerm = props.semester?.academicTerm
const mode = ref(savedTerm && props.terms.some(term => term.id === savedTerm.id) ? 'known' : 'custom')
const form = reactive({
  academicTermId: mode.value === 'known' ? savedTerm?.id || '' : '', academicYear: savedTerm?.academicYear || '', name: savedTerm?.name || '',
  startDate: savedTerm?.startDate?.slice(0, 10) || '', endDate: savedTerm?.endDate?.slice(0, 10) || '', targetSemesterGpa: props.semester?.targetSemesterGpa ?? '', currentCumulativeGpa: props.semester?.currentCumulativeGpa ?? ''
})
const errors = ref({})
function submit() {
  const payload = {
    academicTermId: mode.value === 'known' ? form.academicTermId : undefined,
    customTerm: mode.value === 'custom' ? { academicYear: form.academicYear, name: form.name, startDate: form.startDate, endDate: form.endDate } : undefined,
    targetSemesterGpa: form.targetSemesterGpa,
    currentCumulativeGpa: form.currentCumulativeGpa
  }
  const result = semesterOnboardingSchema.safeParse(payload)
  errors.value = validationFieldErrors(result)
  if (result.success) emit('submit', result.data)
}
</script>

<template>
  <form class="onboarding-form" novalidate @submit.prevent="submit">
    <header class="onboarding-step-heading"><p>Step 3</p><component :is="headingLevel">Set your academic horizon</component><span>Define the term you are working through and the GPA you are aiming for.</span></header>
    <div v-if="terms.length" class="onboarding-choice" role="radiogroup" aria-label="Term source">
      <label><input v-model="mode" type="radio" value="known"> Official term</label><label><input v-model="mode" type="radio" value="custom"> Custom term</label>
    </div>
    <div v-if="mode === 'known'" class="onboarding-field"><label for="academicTermId">Academic term</label><select id="academicTermId" v-model="form.academicTermId"><option value="" disabled>Select term</option><option v-for="term in terms" :key="term.id" :value="term.id">{{ term.academicYear }} · {{ term.name }}</option></select><small>{{ errors.academicTermId || fieldErrors?.academicTermId }}</small></div>
    <template v-else>
      <p class="onboarding-note">Official term dates are not yet available. Enter dates from your university calendar.</p>
      <div class="onboarding-form__grid">
        <div class="onboarding-field"><label for="academicYear">Academic year</label><input id="academicYear" v-model="form.academicYear" placeholder="2026/27" autocomplete="off"><small>{{ errors.academicYear || fieldErrors?.academicYear }}</small></div>
        <div class="onboarding-field"><label for="termName">Semester name</label><input id="termName" v-model="form.name" placeholder="Semester 1" autocomplete="off"><small>{{ errors.name || fieldErrors?.name }}</small></div>
        <div class="onboarding-field"><label for="startDate">Semester start date</label><input id="startDate" v-model="form.startDate" type="date"><small>{{ errors.startDate || fieldErrors?.startDate }}</small></div>
        <div class="onboarding-field"><label for="endDate">Semester end date</label><input id="endDate" v-model="form.endDate" type="date"><small>{{ errors.endDate || fieldErrors?.endDate }}</small></div>
      </div>
    </template>
    <div class="onboarding-form__grid">
      <div class="onboarding-field"><label for="targetSemesterGpa">Target semester GPA</label><input id="targetSemesterGpa" v-model="form.targetSemesterGpa" type="number" min="0" max="5" step="0.01" inputmode="decimal"><small>{{ errors.targetSemesterGpa || fieldErrors?.targetSemesterGpa }}</small></div>
      <div class="onboarding-field"><label for="currentCumulativeGpa">Current cumulative GPA <em>Optional</em></label><input id="currentCumulativeGpa" v-model="form.currentCumulativeGpa" type="number" min="0" max="5" step="0.01" inputmode="decimal"><small>{{ errors.currentCumulativeGpa || fieldErrors?.currentCumulativeGpa }}</small></div>
    </div>
    <p v-if="serverError" class="onboarding-alert" role="alert" aria-live="polite">{{ serverError }}</p>
    <div class="onboarding-actions"><button v-if="showBack" type="button" class="onboarding-secondary" @click="emit('back')">Back</button><span v-else /><button type="submit" class="onboarding-primary" :disabled="saving">{{ saving ? 'Saving…' : submitLabel }}</button></div>
  </form>
</template>
