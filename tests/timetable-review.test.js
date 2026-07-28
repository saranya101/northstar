import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPublicEnrichmentSuggestion, canConfirmReview, cloneReviewModules, groupReviewSessions, initialExpandedModuleIds, issueTargetId, revealReviewIssue, reviewIssues } from '../app/utils/timetable-import/timetable-review'

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

  it('reports the exact conflicting pair and immediately clears after an edit', () => {
    const modules = [
      module({ candidateId: 'm1', code: 'AB1201', sessions: [session({ candidateId: 's1', weekNumbers: [3, 7], startMinutes: 540, endMinutes: 630 })] }),
      module({ candidateId: 'm2', code: 'HE5091', indexNumber: '54321', sessions: [session({ candidateId: 's2', weekNumbers: [7, 8], startMinutes: 600, endMinutes: 660 })] })
    ]
    const conflicts = reviewIssues(modules)
    expect(conflicts).toEqual(expect.arrayContaining([expect.objectContaining({
      field: 'conflict', label: 'AB1201 conflicts with HE5091', context: 'MONDAY 09:00–10:30 · weeks 7'
    })]))
    expect(canConfirmReview(modules, conflicts.length, 'MATCH')).toBe(false)

    modules[1].sessions[0].dayOfWeek = 'TUESDAY'
    expect(reviewIssues(modules).filter(issue => issue.field === 'conflict')).toHaveLength(0)
  })

  it('reports each structural mismatch and blocks confirmation', () => {
    const modules = [
      module({ candidateId: 'm1', titleNeedsReview: true, examCandidate: null }),
      module({ candidateId: 'm2', code: 'AB1201', indexNumber: '12345', academicUnits: 2, examCandidate: null })
    ]
    const draft = { sourceSummary: { moduleCount: 6, totalAcademicUnits: 16 }, structure: { gridVisible: true, gridModuleCodes: ['AB1201', 'AD1102'], detectedSessionBlocks: { AB1201: 1 }, droppedSessionBlockCount: 1, examRowsDetected: 6 } }
    const issues = reviewIssues(modules, draft)
    expect(issues.map(item => item.label)).toEqual(expect.arrayContaining([
      expect.stringContaining('6 courses'),
      expect.stringContaining('16 AU'),
      'A visible weekly grid produced no sessions',
      expect.stringContaining('AD1102'),
      expect.stringContaining('visible class block'),
      expect.stringContaining('exam rows'),
      'Review the visibly truncated title',
      expect.stringContaining('Duplicate module/index')
    ]))
    expect(canConfirmReview(modules, issues.length, 'MATCH')).toBe(false)
  })

  it('applies only public title metadata and preserves index-specific timetable data', () => {
    const imported = module({
      code: 'AB1501', title: 'arketing', academicUnits: 3, indexNumber: '00879', registrationStatus: 'REGISTERED',
      titleNeedsReview: true, examCandidate: { applicable: false, rawText: 'Not Applicable' },
      sessions: [session({ groupLabel: '19', venue: 'TR+110', weekNumbers: [2, 3, 4] })]
    })
    applyPublicEnrichmentSuggestion(imported, {
      available: true, title: 'Marketing', academicUnits: 3, description: null, gradingBasis: null, school: null,
      officialUrl: 'https://www.ntu.edu.sg/', fieldProvenance: {}, verificationStatus: 'PUBLIC_SOURCE_CONFLICT'
    })
    expect(imported).toMatchObject({
      title: 'Marketing', indexNumber: '00879', registrationStatus: 'REGISTERED',
      examCandidate: { applicable: false, rawText: 'Not Applicable' },
      sessions: [{ groupLabel: '19', venue: 'TR+110', weekNumbers: [2, 3, 4] }],
      titleNeedsReview: false, publicEnrichmentConfirmed: true
    })
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
    expect(page).toMatch(/moveSession\(module, session/)
    expect(page).toMatch(/markManual\(session, 'dayOfWeek'\)/)
    expect(page).toMatch(/Physical block/)
    expect(page).toMatch(/findTimetableConflicts\(selectedSessions\.value\)/)
  })
})
