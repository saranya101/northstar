import { safeLocalRedirect } from './auth-redirect'

export function protectedRouteDestination(user, intendedDestination) {
  if (user) {
    return null
  }

  const destination = safeLocalRedirect(intendedDestination)
  return `/login?redirect=${encodeURIComponent(destination)}`
}

export function guestRouteDestination(user, completed, requestedDestination, currentPath) {
  if (!user) return null
  if (!completed) return currentPath === '/onboarding' ? null : '/onboarding'

  const destination = safeLocalRedirect(requestedDestination, '/app', currentPath)
  return destination === currentPath ? null : destination
}
