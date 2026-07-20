import { onboardingRouteDestination } from '~/utils/onboarding-navigation'

export default defineNuxtRouteMiddleware(async () => {
  const { state, load } = useOnboarding()
  await load()
  const destination = onboardingRouteDestination(state.value?.onboardingCompleted)
  if (destination) return navigateTo(destination)
})
