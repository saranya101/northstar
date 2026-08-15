import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(new URL('../app/components/academic/MailIntakePanel.vue', import.meta.url), 'utf8')

describe('multi-email intake review UI', () => {
  it('offers independent batch review without replacing the compact single-email action', () => {
    expect(component).toContain("'emails' }} detected")
    expect(component).toContain('Review the boundaries before any intake is created.')
    expect(component).toContain('Process all')
    expect(component).toContain('Process this email')
    expect(component).toContain('Merge with previous')
    expect(component).toContain('Add manual split')
    expect(component).toContain('Deliberately proceed as one')
    expect(component).toContain('Structure for review')
  })

  it('keeps active, archived, and dismissed mail distinct', () => {
    expect(component).toContain("['active','archived','dismissed']")
    expect(component).toContain("decide(intake, 'archive')")
    expect(component).toContain("decide(intake, 'dismiss')")
    expect(component).not.toMatch(/Delete Outlook/i)
  })
})
