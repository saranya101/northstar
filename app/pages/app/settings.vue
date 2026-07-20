<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Settings · Northstar' })
const { state, saving, error, fieldErrors, save } = useOnboarding()
const { state: modules, load: loadModules } = useModules()
const savedMessage = ref('')
const currentTerms = computed(() => state.value?.universities?.find(item => item.id === state.value?.academicProfile?.universityId)?.academicTerms || [])
await loadModules()

async function saveSetting(path, payload) {
  savedMessage.value = ''
  if (await save(path, payload)) savedMessage.value = 'Changes saved.'
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-page__header"><div><p>Northstar settings</p><h1>Academic profile</h1><span>Keep the foundation of your workspace accurate.</span></div></header>
    <p v-if="savedMessage" class="settings-saved" role="status" aria-live="polite">{{ savedMessage }}</p>
    <section class="settings-card settings-modules"><div><p>Current semester</p><h2>Modules</h2><span>{{ modules?.activeCount ?? 0 }} active {{ modules?.activeCount === 1 ? 'module' : 'modules' }}</span></div><UButton to="/app/modules" color="neutral" variant="outline">Manage modules</UButton></section>
    <section class="settings-card"><OnboardingProfileStep :profile="state?.profile" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save profile" @submit="saveSetting('profile', $event)" /></section>
    <section class="settings-card"><OnboardingAcademicStep :academic-profile="state?.academicProfile" :universities="state?.universities" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save academic profile" :show-back="false" @submit="saveSetting('academic', $event)" /></section>
    <section class="settings-card"><OnboardingSemesterStep :semester="state?.semester" :terms="currentTerms" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save GPA goals" :show-back="false" @submit="saveSetting('semester', $event)" /></section>
    <section class="settings-card"><OnboardingStudyPreferencesStep :preference="state?.studyPreference" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save preferences" :show-back="false" @submit="saveSetting('preferences', $event)" /></section>
  </main>
</template>
