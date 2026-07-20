import { describe, expect, it } from 'vitest'
import { assertAuthenticatedSession } from '../server/utils/session-guard'

describe('protected API session guard', () => {
  it('throws HTTP 401 without a session', () => {
    expect(() => assertAuthenticatedSession(null)).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
  })

  it('returns an authenticated session', () => {
    const session = { user: { id: 'user-id' } }
    expect(assertAuthenticatedSession(session)).toBe(session)
  })
})
