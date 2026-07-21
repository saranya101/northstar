import { onboardingRouteDestination } from '~/utils/onboarding-navigation'

export default defineNuxtRouteMiddleware((to) => {
  const nuxtApp = useNuxtApp()
  const { user } = useCurrentSession()
  const { state, load } = useOnboarding()

  const redirectIfRequired = () => {
    const destination = onboardingRouteDestination(state.value?.onboardingCompleted, to.path)
    if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
  }

  if (!state.value) {
    if (user.value) void load().then(redirectIfRequired).catch(() => {})
    return
  }

  return redirectIfRequired()
})
