import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync(new URL('../app/layouts/app.vue', import.meta.url), 'utf8')
const itemPattern = /\{ label: '([^']+)', to: '([^']+)', icon: '([^']+)' \}/g
const items = [...layout.matchAll(itemPattern)].map(([, label, to, icon]) => ({ label, to, icon }))

describe('authenticated application navigation', () => {
  it('shows planner, calendar and focus exactly once with the correct routes', () => {
    expect(items.filter(item => item.label === 'Planner')).toEqual([{ label: 'Planner', to: '/app/planner', icon: 'i-lucide-calendar-range' }])
    expect(items.filter(item => item.label === 'Calendar')).toEqual([{ label: 'Calendar', to: '/app/calendar', icon: 'i-lucide-calendar-days' }])
    expect(items.filter(item => item.label === 'Focus')).toEqual([{ label: 'Focus', to: '/app/focus', icon: 'i-lucide-timer' }])
  })

  it('keeps the required navigation order without a global coursework item', () => {
    expect(items.map(item => item.label)).toEqual([
      'Overview', 'Modules', 'Timetable', 'Planner', 'Calendar', 'Focus', 'Opportunities', 'Settings'
    ])
    expect(items.some(item => item.label === 'Coursework')).toBe(false)
  })

  it('preserves accessible labels, mobile navigation and nested-route activation', () => {
    expect(layout.match(/:aria-label="item.label"/g)).toHaveLength(2)
    expect(layout.match(/isNavigationActive\(item\.to\)/g)).toHaveLength(4)
    expect(layout).toContain("destination !== '/app'")
    expect(layout).toContain('@click="mobileOpen = false"')
  })
})
