import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync(new URL('../app/layouts/app.vue', import.meta.url), 'utf8')
const itemPattern = /\{ label: '([^']+)', to: '([^']+)', icon: '([^']+)' \}/g
const items = [...layout.matchAll(itemPattern)].map(([, label, to, icon]) => ({ label, to, icon }))

describe('authenticated V2 navigation', () => {
  it('uses the required primary academic order exactly once', () => {
    expect(items.slice(0, 7).map(item => item.label)).toEqual(['Today', 'Modules', 'Tasks', 'Planner', 'Calendar', 'Focus', 'Inbox'])
    for (const label of ['Today', 'Modules', 'Tasks', 'Planner', 'Calendar', 'Focus', 'Inbox', 'Timetable', 'Opportunities']) expect(items.filter(item => item.label === label)).toHaveLength(1)
  })

  it('keeps secondary routes out of primary navigation and no document links', () => {
    expect(items.find(item => item.label === 'Timetable')?.to).toBe('/app/timetable')
    expect(items.find(item => item.label === 'Opportunities')?.to).toBe('/app/opportunities')
    expect(layout).not.toMatch(/Coursework|Documents|PDF|OCR/)
  })

  it('preserves accessible mobile and nested-route semantics', () => {
    expect(layout).toContain('aria-label="Application navigation"')
    expect(layout).toContain('aria-label="Open navigation"')
    expect(layout).toContain(':aria-current="isActive(item.to) ? \'page\' : undefined"')
    expect(layout).toContain("destination !== '/app'")
    expect(layout).toContain('@click="mobileOpen = false"')
  })
})
