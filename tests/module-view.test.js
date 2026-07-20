import { describe, expect, it } from 'vitest'
import { activeModuleCount, hasActiveModules } from '../app/utils/module-view'

describe('module page state', () => {
  it('shows the empty state only when there are no real module records', () => {
    expect(hasActiveModules(null)).toBe(false)
    expect(hasActiveModules({ modules: [] })).toBe(false)
    expect(hasActiveModules({ modules: [{ enrolmentId: 'e1' }] })).toBe(true)
  })

  it('uses the server-provided active module count', () => {
    expect(activeModuleCount({ activeCount: 3 })).toBe(3)
    expect(activeModuleCount(null)).toBe(0)
  })
})
