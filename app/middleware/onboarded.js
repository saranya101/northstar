import { appOnboardingDestination } from '~/utils/onboarding-navigation'

export default defineNuxtRouteMiddleware(async () => {
  const { state, load } = useOnboarding()
  await load()
  const destination = appOnboardingDestination(state.value?.onboardingCompleted)
  if (destination) return navigateTo(destination)
})
