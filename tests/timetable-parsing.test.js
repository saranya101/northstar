import { describe, expect, it } from 'vitest'
import { sanitiseIdentityText } from '../app/utils/timetable-import/identity-sanitiser'
import { parseNtuRegisteredCourses } from '../app/utils/timetable-import/ntu-registered-courses-parser'
import { findModuleCodes, parseTimetableText } from '../app/utils/timetable-import/timetable-text-parser'
import { clockValueToMinutes, normalizeDay, parseTime, parseTimeRange } from '../app/utils/timetable-import/timetable-time'
import { mapRegistrationStatus } from '../app/utils/timetable-import/timetable-candidate-normaliser'

describe('deterministic timetable text parsing', () => {
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
