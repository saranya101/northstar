import { safeLocalRedirect } from './auth-redirect'

export function resumeOnboardingStep(step, completed = false) {
  if (completed) return 5
  return Math.min(5, Math.max(1, Number.isInteger(step) ? step : 1))
}

export function authenticatedLanding(completed, requestedDestination, currentPath = '') {
  return completed ? safeLocalRedirect(requestedDestination, '/app', currentPath) : '/onboarding'
}

export function appOnboardingDestination(completed, currentPath = '') {
  return completed || currentPath === '/onboarding' ? null : '/onboarding'
}

export function onboardingRouteDestination(completed, currentPath = '') {
  return completed && currentPath !== '/app' ? '/app' : null
}
