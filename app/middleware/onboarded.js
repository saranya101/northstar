import { appOnboardingDestination } from '~/utils/onboarding-navigation'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const { state, load } = useOnboarding()
  await load()
  const destination = appOnboardingDestination(state.value?.onboardingCompleted, to.path)
  if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
})
