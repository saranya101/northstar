import { describe, expect, it } from 'vitest'
import { parseNtuRegisteredCourses } from '../app/utils/timetable-import/ntu-registered-courses-parser'
import { detectTimetableFormat } from '../app/utils/timetable-import/format-detector'
import { parseStructuredRecord } from '../app/utils/timetable-import/structured-timetable-parser'
import { reviewIssues } from '../app/utils/timetable-import/timetable-review'
import { createTimetableImportSchema } from '../shared/schemas/timetable'

const sample = `SEMESTER|academicYear=2026/2027|semester=1|status=REGISTERED|totalAU=16

MODULE|code=AD1102|title=Financial Accounting|au=3|status=REGISTERED
SESSION|module=AD1102|type=SEMINAR|group=14|day=FRIDAY|start=13:30|end=16:20|venue=S4-SR20|delivery=IN_PERSON|weeks=1-13
EXAM|module=AD1102|date=2026-11-23|start=13:00|end=15:30

MODULE|code=HE5091|title=Principles of Economics|au=3|status=REGISTERED
SESSION|module=HE5091|type=LECTURE|group=2|day=MONDAY|start=08:30|end=10:20|venue=LT2A|delivery=IN_PERSON|weeks=1-13
SESSION|module=HE5091|type=TUTORIAL|group=NBS16|day=MONDAY|start=13:30|end=14:20|venue=LHS-TR+44|delivery=IN_PERSON|weeks=2-13
EXAM|module=HE5091|date=2026-11-23|start=17:00|end=19:30

MODULE|code=AB0403|title=Decision Making With Programming & Analytics|au=3|status=REGISTERED
SESSION|module=AB0403|type=SEMINAR|group=5|day=TUESDAY|start=08:30|end=10:20|venue=S4-SR2|delivery=IN_PERSON|weeks=1-13
EXAM|module=AB0403|date=2026-11-24|start=17:00|end=18:30

MODULE|code=AB1201|title=Financial Management|au=3|status=REGISTERED
SESSION|module=AB1201|type=SEMINAR|group=11|day=TUESDAY|start=13:30|end=16:20|venue=ESR4|delivery=IN_PERSON|weeks=1-13
EXAM|module=AB1201|date=2026-11-27|start=09:00|end=11:30

MODULE|code=AB1088|title=Career Launchpad|au=1|status=REGISTERED
SESSION|module=AB1088|type=SEMINAR|group=1|day=MONDAY|start=14:30|end=16:20|venue=CR1|delivery=IN_PERSON|weeks=2-5,10-11
SESSION|module=AB1088|type=LECTURE|group=1|day=THURSDAY|start=14:30|end=17:20|venue=LT19|delivery=IN_PERSON|weeks=2-3,6-11
EXAM|module=AB1088|none=true

MODULE|code=AB1501|title=Marketing|au=3|status=REGISTERED
SESSION|module=AB1501|type=LECTURE|group=1|day=WEDNESDAY|start=09:30|end=10:20|venue=ONLINE|delivery=ONLINE|weeks=1-13
SESSION|module=AB1501|type=TUTORIAL|group=19|day=THURSDAY|start=10:30|end=12:20|venue=TR+110|delivery=IN_PERSON|weeks=2-13
EXAM|module=AB1501|none=true`

const expectedSessions = [
  ['AD1102', 'SEMINAR', '14', 'FRIDAY', 810, 980, 'S4-SR20', 'IN_PERSON', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['HE5091', 'LECTURE', '2', 'MONDAY', 510, 620, 'LT2A', 'IN_PERSON', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['HE5091', 'TUTORIAL', 'NBS16', 'MONDAY', 810, 860, 'LHS-TR+44', 'IN_PERSON', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['AB0403', 'SEMINAR', '5', 'TUESDAY', 510, 620, 'S4-SR2', 'IN_PERSON', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['AB1201', 'SEMINAR', '11', 'TUESDAY', 810, 980, 'ESR4', 'IN_PERSON', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['AB1088', 'SEMINAR', '1', 'MONDAY', 870, 980, 'CR1', 'IN_PERSON', [2, 3, 4, 5, 10, 11]],
  ['AB1088', 'LECTURE', '1', 'THURSDAY', 870, 1040, 'LT19', 'IN_PERSON', [2, 3, 6, 7, 8, 9, 10, 11]],
  ['AB1501', 'LECTURE', '1', 'WEDNESDAY', 570, 620, 'ONLINE', 'ONLINE', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  ['AB1501', 'TUTORIAL', '19', 'THURSDAY', 630, 740, 'TR+110', 'IN_PERSON', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]]
]

describe('structured timetable records', () => {
  it('splits fields on pipes and only the first equals sign', () => {
    expect(parseStructuredRecord('MODULE|code=AB0403|title=Programming & Analytics|url=https://example.test/a/b?x=y|venue=LHS-TR+44|time=13:30|weeks=2-5,10-11')).toEqual({
      type: 'MODULE',
      fields: { code: 'AB0403', title: 'Programming & Analytics', url: 'https://example.test/a/b?x=y', venue: 'LHS-TR+44', time: '13:30', weeks: '2-5,10-11' }
    })
  })

  it('selects the deterministic path before heuristic format detection', () => {
    expect(detectTimetableFormat(sample)).toEqual({ format: 'REGISTERED_COURSES', confidence: 1 })
  })

  it('preserves every explicit module and canonical session field through validation and review', () => {
    const parsed = parseNtuRegisteredCourses(sample, 'PASTED_TEXT')
    const validated = createTimetableImportSchema.parse(parsed)
    expect(validated.modules).toHaveLength(6)
    expect(validated.sourceSummary).toEqual({ moduleCount: 6, totalAcademicUnits: 16 })
    expect(validated.modules.reduce((sum, module) => sum + module.academicUnits, 0)).toBe(16)
    expect(validated.modules.flatMap(module => module.sessions)).toHaveLength(9)
    expect(validated.modules.map(module => module.code)).toEqual(['AD1102', 'HE5091', 'AB0403', 'AB1201', 'AB1088', 'AB1501'])
    expect(validated.modules.every(module => module.registrationStatus === 'REGISTERED')).toBe(true)
    expect(validated.modules.map(module => module.code)).not.toEqual(expect.arrayContaining(['SR20', 'NBS16', 'LT19']))

    const sessions = validated.modules.flatMap(module => module.sessions.map(session => [module.code, session.classType, session.groupLabel, session.dayOfWeek, session.startMinutes, session.endMinutes, session.venue, session.deliveryMode, session.weekNumbers]))
    expect(sessions).toEqual(expectedSessions)
    expect(validated.modules.flatMap(module => module.sessions).every(session => session.timeConfirmed && session.recurrenceConfirmed && session.deliveryModeConfirmed)).toBe(true)
    expect(reviewIssues(validated.modules, validated)).toEqual([])
    expect(validated.warnings).toEqual([])
  })

  it('detects the semester and associates exams, including explicit no-exam records', () => {
    const parsed = createTimetableImportSchema.parse(parseNtuRegisteredCourses(sample))
    expect(parsed.sourceSemester).toEqual({ academicYearStart: 2026, academicYearLabel: '2026/2027', semesterNumber: 1, displayLabel: '2026/2027 Semester 1' })
    expect(parsed.modules.slice(0, 4).map(module => [module.code, module.examCandidate.date, module.examCandidate.startMinutes, module.examCandidate.endMinutes])).toEqual([
      ['AD1102', '2026-11-23', 780, 930],
      ['HE5091', '2026-11-23', 1020, 1170],
      ['AB0403', '2026-11-24', 1020, 1110],
      ['AB1201', '2026-11-27', 540, 690]
    ])
    expect(parsed.modules.slice(4).map(module => [module.code, module.examCandidate])).toEqual([
      ['AB1088', expect.objectContaining({ applicable: false, date: null, startMinutes: null, endMinutes: null })],
      ['AB1501', expect.objectContaining({ applicable: false, date: null, startMinutes: null, endMinutes: null })]
    ])
  })
})
