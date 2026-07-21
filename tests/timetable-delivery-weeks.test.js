import { describe, expect, it } from 'vitest'
import { detectDeliveryMode } from '../app/utils/timetable-import/timetable-delivery'
import { parseNtuSessionBlock } from '../app/utils/timetable-import/ntu-session-block-parser'
import { parseTimetableText } from '../app/utils/timetable-import/timetable-text-parser'
import { parseWeekExpression } from '../app/utils/timetable-import/week-expression'

describe('session delivery detection', () => {
  it.each([
    ['ONLINE', 'ONLINE'],
    ['NBS ONLINE', 'ONLINE'],
    ['TBC', 'TBC'],
    ['LKC-LT', 'IN_PERSON'],
    ['LT26 and MS Teams', 'HYBRID'],
    ['venue unavailable', 'UNKNOWN']
  ])('maps %s to %s', (value, expected) => expect(detectDeliveryMode(value)).toBe(expected))
})

describe('week expressions', () => {
  it.each([
    ['Wk2-13', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
    ['Wk1,12', [1, 12]],
    ['Wk6,10', [6, 10]],
    ['Wk2–4', [2, 3, 4]],
    ['Weeks 1, 3, 5', [1, 3, 5]]
  ])('expands %s', (value, expected) => expect(parseWeekExpression(value)).toMatchObject({ recurrence: 'CUSTOM', weekNumbers: expected, warning: null }))

  it.each(['Wk13-2', 'Wk0', 'Wk21', 'Wk2-x'])('rejects malformed %s without defaulting to weekly', (value) => {
    const result = parseWeekExpression(value)
    expect(result.warning).toBeTruthy()
    expect(result.recurrence).toBeNull()
  })
})

describe('NTU timetable cell parsing', () => {
  it('parses delivery, group, physical venue and selected weeks', () => {
    expect(parseNtuSessionBlock('HE1901 TUT NBS1 S4-SR6; Wk2-13')).toMatchObject({ classType: 'TUTORIAL', groupLabel: 'NBS1', venue: 'S4-SR6', deliveryMode: 'IN_PERSON', recurrence: 'CUSTOM', weekNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] })
    expect(parseNtuSessionBlock('AB1202 LAB 1 TBC; Wk13')).toMatchObject({ classType: 'LABORATORY', groupLabel: '1', venue: 'TBC', deliveryMode: 'TBC', weekNumbers: [13] })
    expect(parseNtuSessionBlock('AB1501 LEC/STU 1 ONLINE')).toMatchObject({ classType: 'LECTURE', groupLabel: '1', deliveryMode: 'ONLINE', recurrenceConfirmed: false })
  })

  it('keeps repeated session blocks as multiple sessions for one module', () => {
    const result = parseTimetableText('AB0601 LEC/STU 1 LKC-LT; Wk13\nAB0601 LEC/STU 1 LT26; Wk15\nAB0601 LEC/STU 1 LT27; Wk13')
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0].sessions).toHaveLength(3)
    expect(result.modules[0].sessions.map(session => session.venue)).toEqual(['LKC-LT', 'LT26', 'LT27'])
  })
})

