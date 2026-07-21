import { protectedRouteDestination } from '~/utils/auth-navigation'

export default defineNuxtRouteMiddleware((to) => {
  const nuxtApp = useNuxtApp()
  const { loadSession, state, user } = useCurrentSession()

  const redirectIfRequired = () => {
    const destination = protectedRouteDestination(user.value, to.fullPath)
    if (destination) return nuxtApp.runWithContext(() => navigateTo(destination))
  }

  if (!state.value.loaded) {
    void loadSession().then(redirectIfRequired).catch(() => {})
    return
  }

  return redirectIfRequired()
})
