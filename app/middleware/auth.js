import { protectedRouteDestination } from '~/utils/auth-navigation'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const { loadSession, user } = useCurrentSession()
  await loadSession()

  const destination = protectedRouteDestination(user.value, to.fullPath)
  if (destination) {
    return nuxtApp.runWithContext(() => navigateTo(destination))
  }
})
