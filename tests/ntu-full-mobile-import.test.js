import { describe, expect, it } from 'vitest'
import { parseNtuTimetableImage } from '../app/utils/timetable-import/ntu-timetable-image-parser'
import { explicitTimeRange } from '../app/utils/timetable-import/ntu-grid-parser'
import { parseNtuExam } from '../app/utils/timetable-import/ntu-registered-table-parser'
import { reviewIssues } from '../app/utils/timetable-import/timetable-review'
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
    expect(sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'HE5091', dayOfWeek: 'MONDAY', startMinutes: 510, endMinutes: 620, venue: 'LT2A' }),
      expect.objectContaining({ code: 'AB0403', dayOfWeek: 'TUESDAY', startMinutes: 510, endMinutes: 620, groupLabel: '5', venue: 'S4-SR2' }),
      expect.objectContaining({ code: 'AB1501', dayOfWeek: 'WEDNESDAY', startMinutes: 570, endMinutes: 620, deliveryMode: 'ONLINE' }),
      expect.objectContaining({ code: 'AB1201', dayOfWeek: 'TUESDAY', startMinutes: 810, endMinutes: 980, venue: 'ESR4' }),
      expect.objectContaining({ code: 'AD1102', dayOfWeek: 'FRIDAY', startMinutes: 810, endMinutes: 980, venue: 'S4-SR20' })
    ]))
    expect(byCode.HE5091.sessions.find(session => session.classType === 'TUTORIAL').weekNumbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(byCode.AB1088.sessions.map(session => session.weekNumbers)).toEqual([
      [2, 3, 4, 5, 10, 11],
      [2, 3, 6, 7, 8, 9, 10, 11]
    ])
    expect(explicitTimeRange('AB1201 SEM 11 ESR4 1330to1620')).toEqual({ startMinutes: 810, endMinutes: 980 })
    expect(sessions.every(session => session.timeConfirmed)).toBe(true)
    expect(findTimetableConflicts(sessions)).toHaveLength(0)
  })

  it('is schema-valid and has no structural issue beyond the truncated title review', () => {
    expect(createTimetableImportSchema.safeParse(result).success).toBe(true)
    expect(reviewIssues(result.modules, result).map(issue => issue.label)).toEqual(['Review the visibly truncated title'])
  })
})
