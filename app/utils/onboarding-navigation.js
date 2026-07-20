import { safeLocalRedirect } from './auth-redirect'

export function resumeOnboardingStep(step, completed = false) {
  if (completed) return 5
  return Math.min(5, Math.max(1, Number.isInteger(step) ? step : 1))
}

export function authenticatedLanding(completed, requestedDestination) {
  return completed ? safeLocalRedirect(requestedDestination) : '/onboarding'
}

export function appOnboardingDestination(completed) {
  return completed ? null : '/onboarding'
}

export function onboardingRouteDestination(completed) {
  return completed ? '/app' : null
}
