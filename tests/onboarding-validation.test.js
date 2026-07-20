import { describe, expect, it } from 'vitest'
import { academicOnboardingSchema, profileOnboardingSchema, semesterOnboardingSchema, studyPreferenceSchema } from '../shared/schemas/onboarding'

const academic = { universityId: 'u1', schoolId: 's1', programmeId: 'p1', admissionYear: 2025, expectedGraduationYear: 2028, currentYearOfStudy: 2 }
const semester = { customTerm: { academicYear: '2026/27', name: 'Semester 1', startDate: '2026-08-10', endDate: '2026-12-05' }, targetSemesterGpa: 4.2, currentCumulativeGpa: 4.0 }

describe('onboarding validation', () => {
  it('validates and trims profile details', () => {
    expect(profileOnboardingSchema.parse({ displayName: '  Avery  ', timezone: 'Asia/Singapore' }).displayName).toBe('Avery')
    expect(profileOnboardingSchema.safeParse({ displayName: 'A', timezone: '' }).success).toBe(false)
  })

  it('validates an academic profile', () => {
    expect(academicOnboardingSchema.safeParse(academic).success).toBe(true)
    expect(academicOnboardingSchema.safeParse({ ...academic, currentYearOfStudy: 9 }).success).toBe(false)
  })

  it('rejects graduation before admission', () => {
    const result = academicOnboardingSchema.safeParse({ ...academic, expectedGraduationYear: 2024 })
    expect(result.success).toBe(false)
    expect(result.error.issues.some(issue => issue.path[0] === 'expectedGraduationYear')).toBe(true)
  })

  it('enforces GPA values from 0 to 5', () => {
    expect(semesterOnboardingSchema.safeParse({ ...semester, targetSemesterGpa: 5.01 }).success).toBe(false)
    expect(semesterOnboardingSchema.safeParse({ ...semester, currentCumulativeGpa: -0.1 }).success).toBe(false)
  })

  it('requires a custom term to end after it starts', () => {
    const result = semesterOnboardingSchema.safeParse({ ...semester, customTerm: { ...semester.customTerm, endDate: '2026-08-01' } })
    expect(result.success).toBe(false)
    expect(result.error.issues.some(issue => issue.path.at(-1) === 'endDate')).toBe(true)
  })

  it('validates study preference bounds', () => {
    const valid = { preferredStudyPeriod: 'EVENING', typicalSessionMinutes: 60, maximumDailyStudyMinutes: 240, weekStartsOn: 1, notificationsEnabled: true }
    expect(studyPreferenceSchema.safeParse(valid).success).toBe(true)
    expect(studyPreferenceSchema.safeParse({ ...valid, typicalSessionMinutes: 10 }).success).toBe(false)
    expect(studyPreferenceSchema.safeParse({ ...valid, maximumDailyStudyMinutes: 1000, weekStartsOn: 7 }).success).toBe(false)
  })
})
