import { describe, expect, it } from 'vitest'
import { overlappingWeekNumbers, recurrencesOverlap, sessionsConflict } from '../app/utils/timetable-import/timetable-conflicts'

const session = (startMinutes, endMinutes, recurrence = 'WEEKLY', weekNumbers = []) => ({ dayOfWeek: 'MONDAY', startMinutes, endMinutes, recurrence, weekNumbers })
describe('timetable conflicts', () => {
  it('does not conflict at touching boundaries', () => expect(sessionsConflict(session(540, 600), session(600, 660))).toBe(false))
  it('detects intersecting intervals', () => expect(sessionsConflict(session(540, 630), session(600, 660))).toBe(true))
  it('understands recurrence overlap', () => {
    expect(recurrencesOverlap(session(0, 1, 'ODD_WEEKS'), session(0, 1, 'EVEN_WEEKS'))).toBe(false)
    expect(recurrencesOverlap(session(0, 1, 'CUSTOM', [3, 7]), session(0, 1, 'CUSTOM', [7, 8]))).toBe(true)
    expect(overlappingWeekNumbers(session(0, 1, 'CUSTOM', [3, 7]), session(0, 1, 'CUSTOM', [7, 8]))).toEqual([7])
    expect(sessionsConflict(session(540, 630, 'CUSTOM', [2, 4]), session(600, 660, 'CUSTOM', [3, 5]))).toBe(false)
  })
})
