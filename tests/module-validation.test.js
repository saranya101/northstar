import { describe, expect, it } from 'vitest'
import {
  createInstructorSchema,
  createManualModuleSchema,
  updateModuleEnrolmentSchema
} from '../shared/schemas/modules'

const validModule = { code: 'ab 1201', title: 'A valid module title', colour: 'MINERAL' }

describe('module validation', () => {
  it('trims and uppercases module codes', () => {
    expect(createManualModuleSchema.parse(validModule).code).toBe('AB 1201')
  })

  it('rejects invalid module codes', () => {
    expect(createManualModuleSchema.safeParse({ ...validModule, code: '#bad' }).success).toBe(false)
  })

  it('enforces title length', () => {
    expect(createManualModuleSchema.safeParse({ ...validModule, title: 'x' }).success).toBe(false)
    expect(createManualModuleSchema.safeParse({ ...validModule, title: 'x'.repeat(161) }).success).toBe(false)
  })

  it('requires academic units greater than zero and no more than 30', () => {
    expect(createManualModuleSchema.safeParse({ ...validModule, academicUnits: 0 }).success).toBe(false)
    expect(createManualModuleSchema.safeParse({ ...validModule, academicUnits: 30.01 }).success).toBe(false)
    expect(createManualModuleSchema.safeParse({ ...validModule, academicUnits: 4 }).success).toBe(true)
  })

  it('rejects invalid colours and instructor roles', () => {
    expect(createManualModuleSchema.safeParse({ ...validModule, colour: 'NEON' }).success).toBe(false)
    expect(createInstructorSchema.safeParse({ fullName: 'Avery Tan', role: 'DEAN' }).success).toBe(false)
  })

  it('accepts HTTPS and rejects HTTP instructor profile URLs', () => {
    expect(createInstructorSchema.safeParse({ fullName: 'Avery Tan', role: 'LECTURER', officialProfileUrl: 'http://example.edu/profile' }).success).toBe(false)
    expect(createInstructorSchema.safeParse({ fullName: 'Avery Tan', role: 'LECTURER', officialProfileUrl: 'https://example.edu/profile' }).success).toBe(true)
  })

  it('rejects invalid lecturer email', () => {
    expect(createManualModuleSchema.safeParse({ ...validModule, lecturerEmail: 'not-an-email' }).success).toBe(false)
  })

  it('rejects an empty update and overlong personal notes', () => {
    expect(updateModuleEnrolmentSchema.safeParse({}).success).toBe(false)
    expect(updateModuleEnrolmentSchema.safeParse({ personalNotes: 'x'.repeat(5001) }).success).toBe(false)
    expect(updateModuleEnrolmentSchema.safeParse({ personalNotes: 'Private note' }).success).toBe(true)
  })

  it('normalises blank private values to null so they can be cleared', () => {
    expect(updateModuleEnrolmentSchema.parse({ targetGrade: '', personalNotes: '' })).toEqual({ targetGrade: null, personalNotes: null })
  })
})
