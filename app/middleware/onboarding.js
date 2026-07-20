import { onboardingRouteDestination } from '~/utils/onboarding-navigation'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const { state, load } = useOnboarding()
  await load()
  const destination = onboardingRouteDestination(state.value?.onboardingCompleted, to.path)
  if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
})
