import { guestRouteDestination } from '~/utils/auth-navigation'

export default defineNuxtRouteMiddleware((to) => {
  const nuxtApp = useNuxtApp()
  const { loadSession, state: session, user } = useCurrentSession()
  const { state, load } = useOnboarding()

  const redirectIfRequired = async () => {
    if (!user.value) return
    if (!state.value) await load()
    const destination = guestRouteDestination(
      user.value,
      state.value?.onboardingCompleted,
      to.query.redirect,
      to.path
    )
    if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
  }

  if (!session.value.loaded) {
    void loadSession().then(redirectIfRequired).catch(() => {})
    return
  }

  if (user.value && !state.value) {
    void redirectIfRequired().catch(() => {})
    return
  }

  return redirectIfRequired()
})
