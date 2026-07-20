<script setup>
import { academicOnboardingSchema, validationFieldErrors } from '~~/shared/schemas/onboarding'

const props = defineProps({ academicProfile: Object, universities: { type: Array, default: () => [] }, saving: Boolean, serverError: String, fieldErrors: Object, headingLevel: { type: String, default: 'h1' }, submitLabel: { type: String, default: 'Save and continue' }, showBack: { type: Boolean, default: true } })
const emit = defineEmits(['back', 'submit'])
const form = reactive({
  universityId: props.academicProfile?.universityId || '', schoolId: props.academicProfile?.schoolId || '', programmeId: props.academicProfile?.programmeId || '',
  admissionYear: props.academicProfile?.admissionYear || new Date().getFullYear(), expectedGraduationYear: props.academicProfile?.expectedGraduationYear || '', currentYearOfStudy: props.academicProfile?.currentYearOfStudy || 1
})
const errors = ref({})
const schools = computed(() => props.universities.find(item => item.id === form.universityId)?.schools || [])
const programmes = computed(() => schools.value.find(item => item.id === form.schoolId)?.programmes || [])

function selectUniversity(event) { form.universityId = event.target.value; form.schoolId = ''; form.programmeId = '' }
function selectSchool(event) { form.schoolId = event.target.value; form.programmeId = '' }
function submit() {
  const result = academicOnboardingSchema.safeParse(form)
  errors.value = validationFieldErrors(result)
  if (result.success) emit('submit', result.data)
}
</script>

<template>
  <form class="onboarding-form" novalidate @submit.prevent="submit">
    <header class="onboarding-step-heading"><p>Step 2</p><component :is="headingLevel">Where are you studying?</component><span>Connect your plan to the institution and programme you are actually following.</span></header>
    <div class="onboarding-field"><label for="universityId">University</label><select id="universityId" :value="form.universityId" @change="selectUniversity"><option value="" disabled>Select university</option><option v-for="item in universities" :key="item.id" :value="item.id">{{ item.name }}</option></select><small>{{ errors.universityId || fieldErrors?.universityId }}</small></div>
    <div class="onboarding-field"><label for="schoolId">School</label><select id="schoolId" :value="form.schoolId" :disabled="!form.universityId" @change="selectSchool"><option value="" disabled>Select school</option><option v-for="item in schools" :key="item.id" :value="item.id">{{ item.name }}</option></select><small>{{ errors.schoolId || fieldErrors?.schoolId }}</small></div>
    <div class="onboarding-field"><label for="programmeId">Programme</label><select id="programmeId" v-model="form.programmeId" :disabled="!form.schoolId"><option value="" disabled>Select programme</option><option v-for="item in programmes" :key="item.id" :value="item.id">{{ item.name }}</option></select><small>{{ errors.programmeId || fieldErrors?.programmeId }}</small></div>
    <div class="onboarding-form__grid">
      <div class="onboarding-field"><label for="admissionYear">Admission year</label><input id="admissionYear" v-model="form.admissionYear" type="number" min="1900" inputmode="numeric" autocomplete="off"><small>{{ errors.admissionYear || fieldErrors?.admissionYear }}</small></div>
      <div class="onboarding-field"><label for="expectedGraduationYear">Expected graduation year <em>Optional</em></label><input id="expectedGraduationYear" v-model="form.expectedGraduationYear" type="number" min="1900" inputmode="numeric" autocomplete="off"><small>{{ errors.expectedGraduationYear || fieldErrors?.expectedGraduationYear }}</small></div>
      <div class="onboarding-field"><label for="currentYearOfStudy">Current year of study</label><input id="currentYearOfStudy" v-model="form.currentYearOfStudy" type="number" min="1" max="8" inputmode="numeric" autocomplete="off"><small>{{ errors.currentYearOfStudy || fieldErrors?.currentYearOfStudy }}</small></div>
    </div>
    <p v-if="serverError" class="onboarding-alert" role="alert" aria-live="polite">{{ serverError }}</p>
    <div class="onboarding-actions"><button v-if="showBack" type="button" class="onboarding-secondary" @click="emit('back')">Back</button><span v-else /><button type="submit" class="onboarding-primary" :disabled="saving">{{ saving ? 'Saving…' : submitLabel }}</button></div>
  </form>
</template>
