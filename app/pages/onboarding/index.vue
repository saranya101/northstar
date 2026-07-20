<script setup>
import { resumeOnboardingStep } from '~/utils/onboarding-navigation'

definePageMeta({ layout: 'onboarding', middleware: ['auth', 'onboarding'] })

const nuxtApp = useNuxtApp()
const { state, loading, saving, error, fieldErrors, save, complete, clearErrors } = useOnboarding()
const currentStep = ref(resumeOnboardingStep(state.value?.onboardingStep, state.value?.onboardingCompleted))

const currentTerms = computed(() => {
  const universityId = state.value?.academicProfile?.universityId
  return state.value?.universities?.find(item => item.id === universityId)?.academicTerms || []
})

function back() { clearErrors(); currentStep.value = Math.max(1, currentStep.value - 1) }
async function saveStep(path, payload, nextStep) {
  const saved = await save(path, payload)
  if (saved) { currentStep.value = nextStep; window.scrollTo({ top: 0, behavior: 'smooth' }) }
}
async function finish() {
  const result = await complete()
  if (result?.redirectTo) {
    await nuxtApp.runWithContext(() => navigateTo(result.redirectTo))
  }
}
</script>

<template>
  <OnboardingShell :current-step="currentStep">
    <p v-if="loading" class="onboarding-loading" aria-live="polite">Loading your setup…</p>
    <OnboardingProfileStep v-else-if="currentStep === 1" :profile="state?.profile" :saving="saving" :server-error="error" :field-errors="fieldErrors" @submit="saveStep('profile', $event, 2)" />
    <OnboardingAcademicStep v-else-if="currentStep === 2" :academic-profile="state?.academicProfile" :universities="state?.universities" :saving="saving" :server-error="error" :field-errors="fieldErrors" @back="back" @submit="saveStep('academic', $event, 3)" />
    <OnboardingSemesterStep v-else-if="currentStep === 3" :semester="state?.semester" :terms="currentTerms" :saving="saving" :server-error="error" :field-errors="fieldErrors" @back="back" @submit="saveStep('semester', $event, 4)" />
    <OnboardingStudyPreferencesStep v-else-if="currentStep === 4" :preference="state?.studyPreference" :saving="saving" :server-error="error" :field-errors="fieldErrors" @back="back" @submit="saveStep('preferences', $event, 5)" />
    <OnboardingComplete v-else :state="state" :saving="saving" :server-error="error" @back="back" @complete="finish" />
  </OnboardingShell>
</template>
