<script setup>
import { createPlannerStorage } from '~/utils/planner-storage.client'
import { createFocusStorage } from '~/utils/focus-storage.client'
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Settings · Northstar' })
const { state, saving, error, fieldErrors, save } = useOnboarding()
const { state: modules, load: loadModules } = useModules()
const { user } = useCurrentSession()
const savedMessage = ref('')
const resetError = ref('')
const currentTerms = computed(() => state.value?.universities?.find(item => item.id === state.value?.academicProfile?.universityId)?.academicTerms || [])
watch(user, (currentUser) => {
  if (currentUser) void loadModules().catch(() => {})
}, { immediate: true })

async function saveSetting(path, payload) {
  savedMessage.value = ''
  if (await save(path, payload)) savedMessage.value = 'Changes saved.'
}
function resetLocalStudyData() {
  resetError.value = ''
  if (!user.value?.id) { resetError.value = 'Sign in again before clearing local study data.'; return }
  if (!globalThis.confirm('Clear Planner blocks and Focus timer/history stored in this browser?')) return
  createPlannerStorage().removeUserData(user.value.id)
  createFocusStorage().removeUserData(user.value.id)
  savedMessage.value = 'Planner and Focus data were cleared from this browser.'
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-page__header"><div><p>Northstar settings</p><h1>Academic profile</h1><span>Keep the foundation of your workspace accurate.</span></div></header>
    <p v-if="savedMessage" class="settings-saved" role="status" aria-live="polite">{{ savedMessage }}</p>
    <div v-if="!state" class="settings-skeleton" aria-label="Loading settings">
      <div v-for="item in 4" :key="item" class="settings-card app-skeleton app-skeleton--panel"><span /><span /><span /></div>
    </div>
    <template v-else>
    <section class="settings-card settings-modules"><div><p>Current semester</p><h2>Modules</h2><span>{{ modules?.activeCount ?? 0 }} active {{ modules?.activeCount === 1 ? 'module' : 'modules' }}</span></div><UButton to="/app/modules" color="neutral" variant="outline">Manage modules</UButton></section>
    <SettingsOpportunityRadarSettings @saved="savedMessage = 'Opportunity Radar preferences saved.'" />
    <section class="settings-card"><OnboardingProfileStep :profile="state.profile" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save profile" @submit="saveSetting('profile', $event)" /></section>
    <section class="settings-card"><OnboardingAcademicStep :academic-profile="state?.academicProfile" :universities="state?.universities" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save academic profile" :show-back="false" @submit="saveSetting('academic', $event)" /></section>
    <section class="settings-card"><OnboardingSemesterStep :semester="state?.semester" :terms="currentTerms" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save GPA goals" :show-back="false" @submit="saveSetting('semester', $event)" /></section>
    <section class="settings-card"><OnboardingStudyPreferencesStep :preference="state?.studyPreference" :saving="saving" :server-error="error" :field-errors="fieldErrors" heading-level="h2" submit-label="Save preferences" :show-back="false" @submit="saveSetting('preferences', $event)" /></section>
    <section class="settings-card settings-modules"><div><p>Browser-local data</p><h2>Planner and Focus</h2><span>This does not affect server data. Clearing cannot be undone.</span><small v-if="resetError" role="alert">{{ resetError }}</small></div><UButton color="error" variant="soft" @click="resetLocalStudyData">Clear local study data</UButton></section>
    </template>
  </main>
</template>
