import { describe, expect, it } from 'vitest'
import { classSessionCreateSchema, confirmTimetableImportSchema, createTimetableImportSchema } from '../shared/schemas/timetable'
import { validateTimetableFile } from '../app/utils/timetable-import/file-validation'

describe('timetable validation', () => {
  const session = overrides => ({ candidateId: 's1', classType: 'LECTURE', groupLabel: 'DEFAULT', dayOfWeek: 'MONDAY', startMinutes: 570, endMinutes: 680, timeConfirmed: false, timeAlternatives: [], venue: null, deliveryMode: 'UNKNOWN', deliveryModeConfirmed: false, recurrence: 'WEEKLY', recurrenceConfirmed: false, weekNumbers: [], confidence: .5, selected: true, warnings: [], ...overrides })
  const module = value => ({ candidateId: 'm1', code: 'AB1201', title: 'Test', academicUnits: 3, indexNumber: null, courseType: null, registrationStatus: 'REGISTERED', confidence: 1, selected: true, sessions: [value], examCandidate: null, fieldProvenance: {}, corrections: [], publicEnrichment: null, publicEnrichmentConfirmed: true })
  const draft = value => ({ source: 'NTU_TIMETABLE_IMAGE', modules: [module(value)], sourceSemester: null, sourceSummary: null, unmatchedTimetableText: [], segmentation: null, warnings: [] })
  const alternatives = [
    { source: 'EXPLICIT_TEXT', startMinutes: 570, endMinutes: 680, confidence: .88, label: 'Detected from cell text', warnings: [] },
    { source: 'GRID_GEOMETRY', startMinutes: 600, endMinutes: 690, confidence: .62, reason: 'Inferred from grid position.', warnings: [] }
  ]
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
  it('accepts explicit draft time-review fields and unresolved alternatives', () => {
    const result = createTimetableImportSchema.safeParse(draft(session({ startMinutes: null, endMinutes: null, timeConfirmed: false, timeAlternatives: alternatives })))
    expect(result.success).toBe(true)
    expect(result.data.modules[0].sessions[0]).toMatchObject({ timeConfirmed: false, timeAlternatives: alternatives })
  })
  it('defaults absent draft time-review fields safely', () => {
    const value = session({}); delete value.timeConfirmed; delete value.timeAlternatives
    const result = createTimetableImportSchema.parse(draft(value))
    expect(result.modules[0].sessions[0]).toMatchObject({ timeConfirmed: false, timeAlternatives: [] })
  })
  it('keeps alternatives strict and validates their minute interval', () => {
    expect(createTimetableImportSchema.safeParse(draft(session({ timeAlternatives: [{ ...alternatives[0], rawText: 'unsafe OCR' }] }))).success).toBe(false)
    expect(createTimetableImportSchema.safeParse(draft(session({ timeAlternatives: [{ ...alternatives[0], startMinutes: 1440 }] }))).success).toBe(false)
    expect(createTimetableImportSchema.safeParse(draft(session({ timeAlternatives: [{ ...alternatives[0], endMinutes: 0 }] }))).success).toBe(false)
    expect(createTimetableImportSchema.safeParse(draft(session({ timeAlternatives: [{ ...alternatives[0], startMinutes: 700, endMinutes: 680 }] }))).success).toBe(false)
  })
  it('rejects unresolved alternatives at confirmation and accepts the selected alternative', () => {
    const unresolved = confirmTimetableImportSchema.safeParse({ expectedUpdatedAt: new Date().toISOString(), modules: [module(session({ timeAlternatives: alternatives }))] })
    expect(unresolved.success).toBe(false)
    const selected = confirmTimetableImportSchema.safeParse({ expectedUpdatedAt: new Date().toISOString(), modules: [module(session({ startMinutes: alternatives[0].startMinutes, endMinutes: alternatives[0].endMinutes, timeConfirmed: true, timeAlternatives: [], deliveryMode: 'IN_PERSON', deliveryModeConfirmed: true, recurrenceConfirmed: true }))] })
    expect(selected.success).toBe(true)
  })
})
