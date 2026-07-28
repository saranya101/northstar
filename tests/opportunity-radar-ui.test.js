import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  opportunityCadenceMs,
} from '../app/utils/opportunity-cadence.js'

const root = new URL('..', import.meta.url).pathname
const read = file => readFileSync(join(root, file), 'utf8')

describe('personalised Opportunity Radar UI', () => {
  it('maps cadence exactly and makes manual timer-free', () => {
    expect(opportunityCadenceMs('MANUAL')).toBeNull()
    expect(opportunityCadenceMs('HOURLY')).toBe(3_600_000)
    expect(opportunityCadenceMs('EVERY_6_HOURS')).toBe(21_600_000)
    expect(opportunityCadenceMs('EVERY_12_HOURS')).toBe(43_200_000)
    expect(opportunityCadenceMs('DAILY')).toBe(86_400_000)
  })

  it('cleans timers and only automatic-refetches discovery', () => {
    const page = read('app/pages/app/opportunities/index.vue')
    expect(page).toContain('clearCadenceTimer()')
    expect(page).toMatch(/onUnmounted\(\(\) => \{[\s\S]*clearCadenceTimer/)
    expect(page).toMatch(/setTimeout\(async \(\) => \{[\s\S]*loadDiscovery\(true\)/)
    const timerBlock = page.slice(
      page.indexOf('cadenceTimer = setTimeout'),
      page.indexOf('}, interval)'),
    )
    expect(timerBlock).not.toContain('refreshNow()')
  })

  it('renders value only when present with two skills and expandable context', () => {
    const card = read('app/components/opportunities/OpportunityCard.vue')
    expect(card).toContain('v-if="portfolio"')
    expect(card).toContain('skillSignals.slice(0, 2)')
    expect(card).toContain('<details>')
    expect(card).toContain('Make it count:')
  })

  it('supports settings state, cooldown feedback, and truthful resume copy', () => {
    const settings = read('app/components/settings/OpportunityRadarSettings.vue')
    const page = read('app/pages/app/opportunities/index.vue')
    const detail = read('app/pages/app/opportunities/[id].vue')
    expect(settings).toContain(':loading="saving"')
    expect(settings).toContain('Reset to defaults')
    expect(settings).toContain('lastManualRefreshAt: _lastManualRefreshAt')
    expect(page).toContain(':disabled="coolingDown"')
    expect(page).toContain('nextAllowedAt')
    expect(detail).toContain('navigator.clipboard.writeText')
    expect(detail).toContain('Replace placeholders such as [X]')
  })

  it('uses natural-height responsive result grids', () => {
    const css = read('app/assets/css/opportunity-discovery.css')
    expect(css).toMatch(/\.opportunity-radar-page \.opportunity-grid \{[\s\S]*repeat\(3/)
    expect(css).toMatch(/max-width: 1100px[\s\S]*repeat\(2/)
    expect(css).toMatch(/max-width: 700px[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
    expect(css).toContain('align-items: start')
    expect(css).toContain('height: auto')
  })

  it('keeps refresh authenticated without exposing the cron endpoint', () => {
    const route = read('server/api/opportunities/refresh.post.js')
    expect(route).toContain('requireOpportunityUser(event)')
    expect(route).toContain('refreshOpportunitiesForUser(user.id)')
    expect(route).not.toContain('CRON_SECRET')
    expect(route).not.toContain('/api/cron')
  })
})
