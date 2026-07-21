import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canConfirmReview, cloneReviewModules, groupReviewSessions, initialExpandedModuleIds, issueTargetId, revealReviewIssue, reviewIssues } from '../app/utils/timetable-import/timetable-review'

const session = overrides => ({ candidateId: 's1', selected: true, classType: 'LECTURE', groupLabel: 'LE', dayOfWeek: 'MONDAY', startMinutes: 540, endMinutes: 600, timeConfirmed: true, timeAlternatives: [], venue: 'LT1', deliveryModeConfirmed: true, recurrence: 'CUSTOM', recurrenceConfirmed: true, weekNumbers: [1, 3], ...overrides })
const module = overrides => ({ candidateId: 'm1', selected: true, code: 'AB1201', title: 'Test module', academicUnits: 3, indexNumber: '12345', publicEnrichmentConfirmed: true, sessions: [], ...overrides })

describe('timetable review presentation', () => {
  it('starts modules with issues expanded and valid modules collapsed', () => {
    const modules = [module({ candidateId: 'valid' }), module({ candidateId: 'issue', sessions: [session({ timeConfirmed: false })] })]
    expect(initialExpandedModuleIds(modules)).toEqual(['issue'])
  })

  it('groups matching sessions while preserving every original object and candidate ID', () => {
    const first = session({ candidateId: 's1', venue: 'LT1', weekNumbers: [1, 3] })
    const second = session({ candidateId: 's2', venue: 'LT2', weekNumbers: [2, 4] })
    const third = session({ candidateId: 's3', startMinutes: 600, endMinutes: 660 })
    const groups = groupReviewSessions([first, second, third])
    expect(groups).toHaveLength(2)
    expect(groups[0].candidateIds).toEqual(['s1', 's2'])
    expect(groups[0].sessions[0]).toBe(first)
    expect(groups[0].sessions[1]).toBe(second)
  })

  it('creates stable field targets for issue navigation', () => {
    const issues = reviewIssues([module({ sessions: [session({ candidateId: 'session-7', endMinutes: null, recurrenceConfirmed: false })] })])
    expect(issues.map(issue => issue.targetId)).toEqual([issueTargetId('session-7', 'endMinutes'), issueTargetId('session-7', 'recurrence')])
    const expandedModules = new Set()
    const expandedSessions = new Set()
    expect(revealReviewIssue(expandedModules, expandedSessions, issues[0])).toBe(issueTargetId('session-7', 'endMinutes'))
    expect([...expandedModules]).toEqual(['m1'])
    expect([...expandedSessions]).toEqual(['session-7'])
  })

  it('keeps confirmation disabled for a semester mismatch', () => {
    expect(canConfirmReview([module({})], 0, 'MISMATCH')).toBe(false)
    expect(canConfirmReview([module({})], 0, 'MATCH')).toBe(true)
  })

  it('clones a reloaded draft without losing candidate IDs or variants', () => {
    const original = [module({ sessions: [session({ candidateId: 's1' }), session({ candidateId: 's2', venue: 'LT2' })] })]
    const reloaded = cloneReviewModules(JSON.parse(JSON.stringify(original)))
    expect(reloaded).toEqual(original)
    expect(reloaded).not.toBe(original)
    expect(groupReviewSessions(reloaded[0].sessions)[0].candidateIds).toEqual(['s1', 's2'])
  })

  it('continues to save and reload the original modules payload', () => {
    const page = readFileSync(join(new URL('..', import.meta.url).pathname, 'app/pages/app/timetable/import/[id].vue'), 'utf8')
    expect(page).toMatch(/updateImport\(route\.params\.id, \{ modules: modules\.value/)
    expect(page).toMatch(/modules\.value = cloneReviewModules\(value\.modules\)/)
  })
})
