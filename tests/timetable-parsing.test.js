import { describe, expect, it } from 'vitest'
import { sanitiseIdentityText } from '../app/utils/timetable-import/identity-sanitiser'
import { parseNtuRegisteredCourses } from '../app/utils/timetable-import/ntu-registered-courses-parser'
import { findModuleCodes, parseTimetableText } from '../app/utils/timetable-import/timetable-text-parser'
import { clockValueToMinutes, normalizeDay, parseTime, parseTimeRange } from '../app/utils/timetable-import/timetable-time'
import { mapRegistrationStatus } from '../app/utils/timetable-import/timetable-candidate-normaliser'
import { createTimetableImportSchema } from '../shared/schemas/timetable'

describe('deterministic timetable text parsing', () => {
  const moduleLine = 'AB1201 3 CORE 00123 REGISTERED\nAB1201 LEC GROUP 1 MON 0830-0930'
  const expectedSemester = { academicYearStart: 2026, academicYearLabel: '2026/2027', semesterNumber: 1, displayLabel: '2026/2027 Semester 1' }

  it.each([
    ['Academic Year: 2026/2027\nSemester: Semester 1'],
    ['Academic Year 2026/2027\nSemester 1'],
    ['2026/2027 Semester 1'],
    ['AY 2026/27 Sem 1'],
    ['Academic Year 2026, Semester 1']
  ])('detects and normalises pasted semester wording: %s', heading => {
    const result = parseTimetableText(`${heading}\n${moduleLine}`)
    expect(result.sourceSemester).toEqual(expectedSemester)
  })

  it.each([
    ['semester genuinely absent', moduleLine],
    ['academic year only', `Academic Year 2026/2027\n${moduleLine}`],
    ['semester only', `Semester 1\n${moduleLine}`]
  ])('does not invent missing semester metadata: %s', (_label, text) => {
    expect(parseTimetableText(text).sourceSemester).toBeNull()
  })

  it('detects tolerant module codes without treating times or index numbers as modules', () => {
    expect(findModuleCodes('AB1201 0830-0930 index 12345 SC2002A')).toEqual(['AB1201', 'SC2002A'])
  })
  it('normalises day variants', () => {
    expect(normalizeDay('Thurs')).toBe('THURSDAY')
    expect(normalizeDay('SUNDAY')).toBe('SUNDAY')
  })
  it('parses 12-hour, 24-hour and en-dash ranges', () => {
    expect(parseTime('8:30 PM')).toBe(1230)
    expect(parseTime('1430')).toBe(870)
    expect(parseTimeRange('08:30–09:30')).toEqual({ startMinutes: 510, endMinutes: 570 })
  })
  it('normalises raw numeric and string HHMM values without clamping invalid clocks', () => {
    expect(clockValueToMinutes(1900)).toBe(1140)
    expect(clockValueToMinutes('1900')).toBe(1140)
    expect(clockValueToMinutes('19:00')).toBe(1140)
    expect(clockValueToMinutes(1700)).toBe(1020)
    expect(clockValueToMinutes(1765)).toBeNull()
    expect(clockValueToMinutes(2400)).toBeNull()
    expect(clockValueToMinutes(2400, { end: true })).toBe(1440)
    expect(clockValueToMinutes('24:00')).toBeNull()
    expect(clockValueToMinutes('24:00', { end: true })).toBe(1440)
  })
  it('maps registration status variants', () => {
    expect(mapRegistrationStatus('WAITLIST')).toBe('WAITLISTED')
    expect(mapRegistrationStatus('EXEMPTED')).toBe('EXEMPTED')
  })
  it('merges repeated module rows and keeps sessions separate', () => {
    const result = parseNtuRegisteredCourses('AB1201 3 CORE 00123 REGISTERED\nAB1201 LEC GROUP 1 MON 0830-0930\nAB1201 TUT GROUP 2 WED 14:30-15:30')
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0].sessions).toHaveLength(2)
  })
  it('keeps module and session parsing unchanged when semester metadata is present', () => {
    const result = parseTimetableText(`AY 2026/27 Sem 1\n${moduleLine}`)
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0]).toMatchObject({ code: 'AB1201', academicUnits: 3, indexNumber: '00123', registrationStatus: 'REGISTERED' })
    expect(result.modules[0].sessions).toHaveLength(1)
  })
  it('parses the normal human-readable timetable sample without duplicating repeated modules', () => {
    const text = `Academic Year: 2026/2027
Semester: Semester 1

AD1102 Financial Accounting
Index: 01128
AU: 3
Friday 13:30-16:20
Venue: S4-SR20

HE5091 Principles of Economics
Index: 01062
AU: 3
Monday 08:30-10:20
Venue: LT2A

HE5091 Principles of Economics
Tuesday 10:30-11:20
Venue: LHS-TR+51
Weeks: 2-13

AB0403 Decision Making with Programming & Analytics
Index: 00462
AU: 3
Tuesday 08:30-10:20
Venue: S4-SR2

AB1201 Financial Management
Index: 00105
AU: 3
Tuesday 13:30-16:20
Venue: ESR4

AB1088 Career Launchpad
Index: 01215
AU: 1
Wednesday 14:30-16:20
Venue: CR1
Weeks: 2-5, 10-11

AB1088 Career Launchpad
Thursday 14:30-17:20
Venue: LT19
Weeks: 2-3, 6-11

AB1501 Marketing
Index: 00879
AU: 3
Wednesday 09:30-10:20
Venue: ONLINE

AB1501 Marketing
Thursday 10:30-12:20
Venue: TR+110
Weeks: 2-13`
    const result = createTimetableImportSchema.parse(parseTimetableText(text))
    expect(result.sourceSemester).toEqual(expectedSemester)
    expect(result.modules.map(module => module.code)).toEqual(['AD1102', 'HE5091', 'AB0403', 'AB1201', 'AB1088', 'AB1501'])
    expect(result.modules).toHaveLength(6)
    expect(result.modules.flatMap(module => module.sessions)).toHaveLength(9)
    expect(result.sourceSummary).toEqual({ moduleCount: 6, totalAcademicUnits: 16 })
    expect(result.modules.find(module => module.code === 'HE5091').sessions).toHaveLength(2)
    expect(result.modules.find(module => module.code === 'AB1088').sessions).toHaveLength(2)
    expect(result.modules.find(module => module.code === 'AB1501').sessions).toHaveLength(2)
  })
  it('removes identity lines and never emits matriculation values', () => {
    const text = 'Name TEST ACCOUNT\nMatric 999999999\nAB1201 3 CORE 00123 REGISTERED'
    expect(sanitiseIdentityText(text)).not.toMatch(/TEST ACCOUNT|999999999/)
    const result = parseTimetableText(text)
    expect(result.modules[0]).toMatchObject({ code: 'AB1201', indexNumber: '00123', registrationStatus: 'REGISTERED' })
    expect(JSON.stringify(result)).not.toMatch(/TEST ACCOUNT|999999999/)
  })
  it('warns instead of silently producing an empty import', () => {
    const result = parseTimetableText('unstructured content only')
    expect(result.modules).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
