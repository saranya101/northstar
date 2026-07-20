import { guestRouteDestination } from '~/utils/auth-navigation'

export default defineNuxtRouteMiddleware(async () => {
  const { loadSession, user } = useCurrentSession()
  await loadSession()

  const destination = guestRouteDestination(user.value)
  if (destination) {
    return navigateTo(destination)
  }
})
