import { guestRouteDestination } from '~/utils/auth-navigation'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const { loadSession, user } = useCurrentSession()
  const { state, load } = useOnboarding()
  await loadSession()

  if (!user.value) return
  await load()
  const destination = guestRouteDestination(
    user.value,
    state.value?.onboardingCompleted,
    to.query.redirect,
    to.path
  )
  if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
})
