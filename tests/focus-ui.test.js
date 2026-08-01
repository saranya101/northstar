import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

describe('focus timer UI structure', () => {
  it('adds the authenticated focus route and required controls', () => {
    const page = read('app/pages/app/focus.vue')
    const panel = read('app/components/focus/FocusTimerPanel.vue')

    expect(page).toContain("middleware: ['auth', 'onboarded']")
    expect(panel).toContain('Start focus')
    expect(panel).toContain('Pause')
    expect(panel).toContain('Resume')
    expect(panel).toContain('Finish early')
    expect(panel).toContain('Skip break')
    expect(panel).toContain('Cancel')
    expect(panel).toContain('Reset')
  })

  it('uses semantic and accessible timer controls', () => {
    const panel = read('app/components/focus/FocusTimerPanel.vue')
    expect(panel).toContain('role="timer"')
    expect(panel).toContain('role="progressbar"')
    expect(panel).toMatch(/<button[\s\S]*type="button"/)
    expect(panel).toContain('aria-label="Timer controls"')
  })

  it('keeps focus styling responsive and reduced-motion safe', () => {
    const css = read('app/assets/css/focus.css')
    expect(css).toContain('@media (max-width: 680px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('font-variant-numeric: tabular-nums')
    expect(css).toMatch(/min-height: 44px/)
  })

  it('requires the minimal sidebar navigation entry', () => {
    const layout = read('app/layouts/app.vue')
    expect(layout).toContain("{ label: 'Focus', to: '/app/focus', icon: 'i-lucide-timer' }")
  })
})
