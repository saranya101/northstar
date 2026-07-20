import { describe, expect, it } from 'vitest'
import { appOnboardingDestination, authenticatedLanding, onboardingRouteDestination, resumeOnboardingStep } from '../app/utils/onboarding-navigation'

describe('onboarding route decisions', () => {
  it('redirects incomplete users away from the app', () => {
    expect(appOnboardingDestination(false)).toBe('/onboarding')
    expect(appOnboardingDestination(true)).toBeNull()
  })

  it('redirects completed users away from onboarding', () => {
    expect(onboardingRouteDestination(true)).toBe('/app')
    expect(onboardingRouteDestination(false)).toBeNull()
  })

  it('sends completed login to a safe destination exactly once', () => {
    expect(authenticatedLanding(true, '/app/modules', '/login')).toBe('/app/modules')
    expect(authenticatedLanding(true, '/login', '/login')).toBe('/app')
    expect(authenticatedLanding(false, '/app/modules', '/login')).toBe('/onboarding')
  })

  it('resumes within the saved step range', () => {
    expect(resumeOnboardingStep(3)).toBe(3)
    expect(resumeOnboardingStep(99)).toBe(5)
    expect(resumeOnboardingStep(undefined)).toBe(1)
    expect(resumeOnboardingStep(2, true)).toBe(5)
  })
})
