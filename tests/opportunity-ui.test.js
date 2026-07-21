import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { opportunityTiming } from '../shared/utils/opportunities'

const root = new URL('..', import.meta.url).pathname

describe('opportunity UX foundation', () => {
  it('classifies deadline and event states in a user timezone', () => {
    const now = new Date('2026-08-12T02:00:00.000Z')
    expect(opportunityTiming({ deadline: '2026-08-12T12:00:00.000Z' }, now).label).toBe('Closing today')
    expect(opportunityTiming({ deadline: '2026-08-13T12:00:00.000Z' }, now).label).toBe('Closing tomorrow')
    expect(opportunityTiming({ deadline: '2026-08-10T12:00:00.000Z' }, now).label).toBe('Closed')
    expect(opportunityTiming({ startAt: '2026-08-15T12:00:00.000Z' }, now).label).toBe('Starts in 3 days')
    expect(opportunityTiming({ startAt: '2026-08-10T12:00:00.000Z', endAt: '2026-08-15T12:00:00.000Z' }, now).label).toBe('Ongoing')
    expect(opportunityTiming({}, now).label).toBe('No deadline')
  })

  it('provides mobile-safe structure and 44px controls', () => {
    const css = readFileSync(join(root, 'app/assets/css/main.css'), 'utf8')
    const inbox = readFileSync(join(root, 'app/pages/app/opportunities/index.vue'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.opportunity-filters, \.opportunity-grid/)
    expect(css).toMatch(/\.opportunity-tabs button \{ min-height: 44px/)
    expect(css).toMatch(/\.opportunity-filters input:not\(\[type="checkbox"\]\).*min-height: 44px/)
    expect(css).toMatch(/grid-template-columns: minmax\(0,1fr\)/)
    expect(inbox).toContain('aria-label="Filter opportunities"')
    expect(inbox).toContain('Closing soon')
    expect(inbox).toContain('Saved and applying')
  })

  it('keeps paste extraction separate from confirmation and persistence', () => {
    const page = readFileSync(join(root, 'app/pages/app/opportunities/new.vue'), 'utf8')
    expect(page).toMatch(/const result = await parseText\(paste\.value\)/)
    expect(page).toMatch(/const result = await create\(form\.value\)/)
    expect(page).toContain('Nothing is saved during extraction.')
    expect(page).toContain('Include the original pasted text in my private notes')
  })
})
