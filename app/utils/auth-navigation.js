import { safeLocalRedirect } from './auth-redirect'

export function protectedRouteDestination(user, intendedDestination) {
  if (user) {
    return null
  }

  const destination = safeLocalRedirect(intendedDestination)
  return `/login?redirect=${encodeURIComponent(destination)}`
}

export function guestRouteDestination(user) {
  return user ? '/app' : null
}
