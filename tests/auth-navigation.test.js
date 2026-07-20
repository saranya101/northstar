import { describe, expect, it } from 'vitest'
import { guestRouteDestination, protectedRouteDestination } from '../app/utils/auth-navigation'

describe('auth middleware decisions', () => {
  it('redirects a guest to login and preserves a safe destination', () => {
    expect(protectedRouteDestination(null, '/app?tab=plan'))
      .toBe('/login?redirect=%2Fapp%3Ftab%3Dplan')
  })

  it('does not preserve an unsafe destination', () => {
    expect(protectedRouteDestination(null, '//example.com'))
      .toBe('/login?redirect=%2Fapp')
  })

  it('allows an authenticated user through', () => {
    expect(protectedRouteDestination({ id: 'user-id' }, '/app')).toBeNull()
  })
})

describe('guest middleware decisions', () => {
  it('redirects a completed user to a safe requested destination', () => {
    expect(guestRouteDestination({ id: 'user-id' }, true, '/app/settings', '/login'))
      .toBe('/app/settings')
  })

  it('redirects an incomplete user to onboarding', () => {
    expect(guestRouteDestination({ id: 'user-id' }, false, '/app', '/login'))
      .toBe('/onboarding')
  })

  it('does not preserve an auth route that would loop', () => {
    expect(guestRouteDestination({ id: 'user-id' }, true, '/login', '/login'))
      .toBe('/app')
  })

  it('allows a guest through', () => {
    expect(guestRouteDestination(null, false, '/app', '/login')).toBeNull()
  })
})
