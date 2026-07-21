import { describe, expect, it } from 'vitest'
import { classSessionCreateSchema, confirmTimetableImportSchema } from '../shared/schemas/timetable'
import { validateTimetableFile } from '../app/utils/timetable-import/file-validation'

describe('timetable validation', () => {
  it('rejects unsupported and oversized files', () => {
    expect(() => validateTimetableFile({ type: 'text/plain', size: 10 })).toThrow(/PDF/)
    expect(() => validateTimetableFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toThrow(/10 MB/)
  })
  it('rejects invalid session intervals and week numbers', () => {
    expect(classSessionCreateSchema.safeParse({ classType: 'LECTURE', dayOfWeek: 'MONDAY', startMinutes: 600, endMinutes: 540, recurrence: 'WEEKLY', weekNumbers: [] }).success).toBe(false)
    expect(classSessionCreateSchema.safeParse({ classType: 'LECTURE', dayOfWeek: 'MONDAY', startMinutes: 540, endMinutes: 600, recurrence: 'CUSTOM', weekNumbers: [0] }).success).toBe(false)
  })
  it('blocks confirmation when selected session time is incomplete', () => {
    const result = confirmTimetableImportSchema.safeParse({ expectedUpdatedAt: new Date().toISOString(), modules: [{ candidateId: 'm1', code: 'AB1201', title: 'Test', academicUnits: 3, indexNumber: null, courseType: null, registrationStatus: 'REGISTERED', confidence: 1, selected: true, sessions: [{ candidateId: 's1', classType: 'LECTURE', groupLabel: 'DEFAULT', dayOfWeek: 'MONDAY', startMinutes: 540, endMinutes: null, venue: null, recurrence: 'WEEKLY', weekNumbers: [], confidence: .4, selected: true, warnings: [] }] }] })
    expect(result.success).toBe(false)
  })
})

