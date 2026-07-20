import { describe, expect, it } from 'vitest'
import { normaliseAuthError } from '../app/utils/auth-error'

describe('normaliseAuthError', () => {
  it('normalises invalid credentials', () => {
    expect(normaliseAuthError({ code: 'INVALID_EMAIL_OR_PASSWORD' }))
      .toBe('Invalid email or password.')
  })

  it('normalises duplicate accounts and rate limits', () => {
    expect(normaliseAuthError({ code: 'USER_ALREADY_EXISTS' }))
      .toBe('An account with this email already exists.')
    expect(normaliseAuthError({ status: 429 }))
      .toBe('Too many attempts. Please wait and try again.')
  })

  it('does not expose unknown raw errors', () => {
    expect(normaliseAuthError({ message: 'database hostname and stack trace' }))
      .toBe('Authentication failed. Please try again.')
  })
})
