<script setup>
definePageMeta({ middleware: ['auth', 'onboarded'] })
const { state, saving, error, fieldErrors, load, save } = useOnboarding()
await load()
const savedMessage = ref('')
const currentTerms = computed(() => state.value?.universities?.find(item => item.id === state.value?.academicProfile?.universityId)?.academicTerms || [])

async function saveSetting(path, payload) {
  savedMessage.value = ''
  if (await save(path, payload)) savedMessage.value = 'Changes saved.'
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-page__header"><div><p>Northstar settings</p><h1>Academic profile</h1><span>Keep the foundation of your workspace accurate.</span></div><UButton to="/app" color="neutral" variant="outline">Back to Northstar</UButton></header>
    <p v-if="savedMessage" class="settings-saved" role="status" aria-live="polite">{{ savedMessage }}</p>
    <section class="settings-card"><OnboardingProfileStep :profile="state?.profile" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save profile" @submit="saveSetting('profile', $event)" /></section>
    <section class="settings-card"><OnboardingAcademicStep :academic-profile="state?.academicProfile" :universities="state?.universities" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save academic profile" :show-back="false" @submit="saveSetting('academic', $event)" /></section>
    <section class="settings-card"><OnboardingSemesterStep :semester="state?.semester" :terms="currentTerms" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save GPA goals" :show-back="false" @submit="saveSetting('semester', $event)" /></section>
    <section class="settings-card"><OnboardingStudyPreferencesStep :preference="state?.studyPreference" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save preferences" :show-back="false" @submit="saveSetting('preferences', $event)" /></section>
  </main>
</template>
