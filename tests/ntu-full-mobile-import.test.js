import { describe, expect, it } from 'vitest'
import { parseNtuTimetableImage } from '../app/utils/timetable-import/ntu-timetable-image-parser'
import { explicitTimeRange, parseNtuGrid } from '../app/utils/timetable-import/ntu-grid-parser'
import { parseNtuSessionBlock } from '../app/utils/timetable-import/ntu-session-block-parser'
import { matchAllowedCode, parseNtuExam } from '../app/utils/timetable-import/ntu-registered-table-parser'
import { canConfirmReview, reviewIssues } from '../app/utils/timetable-import/timetable-review'
import { findTimetableConflicts } from '../app/utils/timetable-import/timetable-conflicts'
import { createTimetableImportSchema } from '../shared/schemas/timetable'
import { ntuFullMobileOcrFixture } from './fixtures/ntu-full-mobile-ocr'

const result = parseNtuTimetableImage(ntuFullMobileOcrFixture)
const byCode = Object.fromEntries(result.modules.map(module => [module.code, module]))

describe('full NTU WISH mobile screenshot import', () => {
  it('ignores mobile chrome and reconstructs all six registered-course rows', () => {
    expect(result.modules.map(module => module.code)).toEqual(['AD1102', 'HE5091', 'AB0403', 'AB1201', 'AB1088', 'AB1501'])
    expect(result.sourceSummary).toEqual({ moduleCount: 6, totalAcademicUnits: 16 })
    expect(result.modules.reduce((sum, module) => sum + module.academicUnits, 0)).toBe(16)
    expect(result.modules.map(module => module.indexNumber)).toEqual(['01128', '01062', '00462', '00105', '01215', '00879'])
    expect(result.modules.every(module => module.registrationStatus === 'REGISTERED')).toBe(true)
  })

  it('preserves multiline title punctuation and removes only trailing OCR footnotes', () => {
    expect(byCode.HE5091.title).toBe('Principles of Economics')
    expect(byCode.AB0403.title).toBe('Decision Making with Programming & Analytics')
    expect(byCode.AB1501).toMatchObject({ title: 'arketing', titleNeedsReview: true })
  })

  it('parses four dated exams and two Not Applicable values', () => {
    expect(result.modules.filter(module => module.examCandidate.applicable)).toHaveLength(4)
    expect(result.modules.filter(module => !module.examCandidate.applicable)).toHaveLength(2)
    expect(byCode.AD1102.examCandidate).toMatchObject({ date: '2026-11-23', startMinutes: 780, endMinutes: 930 })
    expect(byCode.HE5091.examCandidate).toMatchObject({ date: '2026-11-23', startMinutes: 1020, endMinutes: 1170 })
    expect(byCode.AB0403.examCandidate).toMatchObject({ date: '2026-11-24', startMinutes: 1020, endMinutes: 1110 })
    expect(byCode.AB1201.examCandidate).toMatchObject({ date: '2026-11-27', startMinutes: 540, endMinutes: 690 })
    expect(parseNtuExam('Not Applicable')).toMatchObject({ applicable: false, date: null })
  })

  it('creates nine separate sessions using explicit printed time ranges', () => {
    const sessions = result.modules.flatMap(module => module.sessions.map(session => ({ code: module.code, ...session })))
    expect(sessions).toHaveLength(9)
    expect(result.structure).toMatchObject({ detectedSessionBlockCount: 9, droppedSessionBlockCount: 0 })
    expect(Object.fromEntries(result.modules.map(module => [module.code, module.sessions.length]))).toEqual({ AD1102: 1, HE5091: 2, AB0403: 1, AB1201: 1, AB1088: 2, AB1501: 2 })
    expect(sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'HE5091', dayOfWeek: 'MONDAY', startMinutes: 510, endMinutes: 620, venue: 'LT2A' }),
      expect.objectContaining({ code: 'HE5091', classType: 'TUTORIAL', groupLabel: 'NBS3', dayOfWeek: 'TUESDAY', startMinutes: 630, endMinutes: 680, venue: 'LHS-TR+51' }),
      expect.objectContaining({ code: 'AB0403', dayOfWeek: 'TUESDAY', startMinutes: 510, endMinutes: 620, groupLabel: '5', venue: 'S4-SR2' }),
      expect.objectContaining({ code: 'AB1501', dayOfWeek: 'WEDNESDAY', startMinutes: 570, endMinutes: 620, deliveryMode: 'ONLINE' }),
      expect.objectContaining({ code: 'AB1201', dayOfWeek: 'TUESDAY', startMinutes: 810, endMinutes: 980, venue: 'ESR4' }),
      expect.objectContaining({ code: 'AD1102', dayOfWeek: 'FRIDAY', startMinutes: 810, endMinutes: 980, groupLabel: '14', venue: 'S4-SR20' })
    ]))
    expect(byCode.HE5091.sessions.find(session => session.classType === 'TUTORIAL').weekNumbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(byCode.AB1088.sessions.map(session => session.weekNumbers)).toEqual([
      [2, 3, 4, 5, 10, 11],
      [2, 3, 6, 7, 8, 9, 10, 11]
    ])
    expect(explicitTimeRange('AB1201 SEM 11 ESR4 1330to1620')).toEqual({ startMinutes: 810, endMinutes: 980 })
    expect(sessions.every(session => session.timeConfirmed)).toBe(true)
    expect(findTimetableConflicts(sessions)).toHaveLength(0)
    expect(JSON.stringify(result.unmatchedTimetableText)).not.toMatch(/\\p0403|S4-SR2|LHS-TR\+51/i)
  })

  it('recovers OCR-confused codes only from one strong registered-module match', () => {
    const registered = ['AD1102', 'HE5091', 'AB0403', 'AB1201', 'AB1088', 'AB1501']
    expect(matchAllowedCode('\\p0403', registered)).toMatchObject({ code: 'AB0403', corrected: true })
    expect(matchAllowedCode('A80403', registered)).toMatchObject({ code: 'AB0403', corrected: true })
    expect(matchAllowedCode('ABO403', registered)).toMatchObject({ code: 'AB0403', corrected: true })
    expect(matchAllowedCode('\\p0403', ['AB0403', 'CB0403'])).toBeNull()
    expect(matchAllowedCode('LT0403', registered)).toBeNull()
  })

  it('does not attach a venue fragment from a neighbouring weekday column', () => {
    const word = (text, x, y, width = 40) => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 14 } })
    const grid = parseNtuGrid([
      word('MON', 100, 20), word('TUE', 300, 20), word('WED', 500, 20), word('THU', 700, 20),
      word('0830', 10, 100), word('0930', 10, 180),
      word('SEM 5', 280, 110, 60), word('0830to1020', 280, 130, 90), word('\\p0403', 280, 150, 60),
      word('S4-SR2', 480, 125, 70)
    ], 'NTU_TIMETABLE_IMAGE', [], { allowedCodes: ['AB0403'], region: { x0: 0, y0: 10, x1: 800, y1: 260 } })
    expect(grid.modules[0].sessions).toHaveLength(1)
    expect(grid.modules[0].sessions[0]).toMatchObject({ dayOfWeek: 'TUESDAY', venue: null, startMinutes: 510, endMinutes: 620 })
    expect(grid.unmatchedTimetableText.map(item => item.text)).toContain('S4-SR2')
  })

  it('uses complementary OCR passes without duplicating sessions', () => {
    expect(ntuFullMobileOcrFixture.words.map(word => word.text)).toEqual(expect.arrayContaining(['Heat', 'Fr']))
    expect(ntuFullMobileOcrFixture.words.map(word => word.text)).not.toEqual(expect.arrayContaining(['LT2A', 'S4-SR20']))
    expect(result.modules.flatMap(module => module.sessions)).toHaveLength(9)
    const repeated = parseNtuTimetableImage({ ...ntuFullMobileOcrFixture, wordVariants: [ntuFullMobileOcrFixture.wordVariants[0], ntuFullMobileOcrFixture.wordVariants[0]] })
    expect(repeated.modules.flatMap(module => module.sessions)).toHaveLength(9)
  })

  it('tolerates edge offsets but rejects equally plausible cross-column boxes', () => {
    const word = (text, x, y, width = 40) => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 14 } })
    const headers = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => word(day, 100 + index * 200, 20))
    const grid = parseNtuGrid([
      ...headers,
      word('0830', -30, 100), word('0930', -30, 180), word('1330', -30, 300), word('1630', -30, 420),
      word('HE5091', 18, 110, 105), word('LEC/STU LEC2', 40, 128, 110), word('LT2A', 45, 146), word('0830to1020', 45, 164, 90),
      word('AD1102', 870, 310, 105), word('SEM 14', 885, 328, 70), word('54-', 900, 346), word('SR20', 900, 364), word('1330to1620', 885, 382, 90),
      word('S4-SR99', 320, 140, 200)
    ], 'NTU_TIMETABLE_IMAGE', [], { allowedCodes: ['HE5091', 'AD1102'], region: { x0: 0, y0: 10, x1: 1200, y1: 500 } })
    expect(grid.modules.find(module => module.code === 'HE5091').sessions[0]).toMatchObject({ dayOfWeek: 'MONDAY', startMinutes: 510, endMinutes: 620, venue: 'LT2A' })
    expect(grid.modules.find(module => module.code === 'AD1102').sessions[0]).toMatchObject({ dayOfWeek: 'FRIDAY', startMinutes: 810, endMinutes: 980, venue: 'S4-SR20' })
    expect(grid.modules.flatMap(module => module.sessions).map(session => session.venue)).not.toContain('S4-SR99')
  })

  it('normalises only the observed NTU room-code OCR pattern', () => {
    expect(parseNtuSessionBlock('AD1102 SEM 14 54- SR20 1330to1620', { dayOfWeek: 'FRIDAY', startMinutes: 810, endMinutes: 980, defaultWeekly: true, codeTokens: ['AD1102'] })).toMatchObject({ groupLabel: '14', venue: 'S4-SR20' })
  })

  it.each([
    ['HE5091', 'MONDAY', 'HE5091 has 2 visible class blocks, but only 1 session was reconstructed'],
    ['AD1102', 'FRIDAY', 'AD1102 has 1 visible class block, but only 0 sessions were reconstructed']
  ])('blocks confirmation when the %s class block is missing', (code, day, expected) => {
    const incomplete = structuredClone(result)
    incomplete.modules.find(module => module.code === code).sessions = incomplete.modules.find(module => module.code === code).sessions.filter(session => session.dayOfWeek !== day)
    const issues = reviewIssues(incomplete.modules, incomplete)
    expect(issues.map(issue => issue.label)).toContain(expected)
    expect(issues.some(issue => issue.field === 'structure')).toBe(true)
    expect(canConfirmReview(incomplete.modules, issues.length, 'MATCH')).toBe(false)
  })

  it('blocks confirmation for a strong unmatched class block without a reusable module anchor', () => {
    const incomplete = structuredClone(result)
    incomplete.structure.detectedSessionBlocks = {}
    incomplete.structure.detectedSessionBlockCount = 10
    incomplete.structure.droppedSessionBlockCount = 1
    const issues = reviewIssues(incomplete.modules, incomplete)
    expect(issues.map(issue => issue.label)).toContain('1 recognised class block was dropped during validation')
    expect(canConfirmReview(incomplete.modules, issues.length, 'MATCH')).toBe(false)
  })

  it('is schema-valid and has no structural issue beyond the truncated title review', () => {
    expect(createTimetableImportSchema.safeParse(result).success).toBe(true)
    expect(reviewIssues(result.modules, result).map(issue => issue.label)).toEqual(['Review the visibly truncated title'])
  })
})
