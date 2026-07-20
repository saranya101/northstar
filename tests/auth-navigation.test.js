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
  it('redirects an authenticated user to the app', () => {
    expect(guestRouteDestination({ id: 'user-id' })).toBe('/app')
  })

  it('allows a guest through', () => {
    expect(guestRouteDestination(null)).toBeNull()
  })
})
