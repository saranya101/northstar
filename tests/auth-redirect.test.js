import { describe, expect, it } from 'vitest'
import { safeLocalRedirect } from '../app/utils/auth-redirect'

describe('safeLocalRedirect', () => {
  it.each([
    'https://example.com',
    'http://example.com',
    '//example.com',
    '/\\example.com',
    'javascript:alert(1)',
    'app'
  ])('rejects external or unsafe destination %s', (destination) => {
    expect(safeLocalRedirect(destination)).toBe('/app')
  })

  it('allows an internal path with query and hash', () => {
    expect(safeLocalRedirect('/app?view=week#today')).toBe('/app?view=week#today')
  })
})
