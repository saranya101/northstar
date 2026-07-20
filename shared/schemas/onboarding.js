import { z } from 'zod'

const currentYear = new Date().getUTCFullYear()
const idSchema = z.string().trim().min(1, 'Select an option.')
const yearSchema = z.coerce.number().int().min(1900).max(currentYear + 20)
const gpaSchema = z.coerce.number().min(0, 'GPA cannot be below 0.').max(5, 'GPA cannot exceed 5.')
const optionalGpaSchema = z.preprocess(
  value => value === '' || value === null || value === undefined ? undefined : value,
  gpaSchema.optional()
)

export const profileOnboardingSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters.').max(60, 'Display name must be 60 characters or fewer.'),
  timezone: z.string().trim().min(1, 'Select a timezone.').max(100)
})

export const academicOnboardingSchema = z.object({
  universityId: idSchema,
  schoolId: idSchema,
  programmeId: idSchema,
  admissionYear: yearSchema,
  expectedGraduationYear: z.preprocess(
    value => value === '' || value === null || value === undefined ? undefined : value,
    yearSchema.optional()
  ),
  currentYearOfStudy: z.coerce.number().int().min(1, 'Year of study must be between 1 and 8.').max(8, 'Year of study must be between 1 and 8.')
}).superRefine((value, context) => {
  if (value.expectedGraduationYear && value.expectedGraduationYear < value.admissionYear) {
    context.addIssue({
      code: 'custom',
      path: ['expectedGraduationYear'],
      message: 'Graduation year cannot be before admission year.'
    })
  }
})

const customTermSchema = z.object({
  academicYear: z.string().trim().min(1, 'Academic year is required.').max(30),
  name: z.string().trim().min(1, 'Semester name is required.').max(80),
  startDate: z.coerce.date({ error: 'Enter a valid start date.' }),
  endDate: z.coerce.date({ error: 'Enter a valid end date.' })
}).refine(value => value.endDate > value.startDate, {
  path: ['endDate'],
  message: 'End date must be after start date.'
})

export const semesterOnboardingSchema = z.object({
  academicTermId: z.string().trim().min(1).optional(),
  customTerm: customTermSchema.optional(),
  targetSemesterGpa: gpaSchema,
  currentCumulativeGpa: optionalGpaSchema
}).refine(value => Boolean(value.academicTermId) !== Boolean(value.customTerm), {
  path: ['academicTermId'],
  message: 'Select an official term or enter a custom term.'
})

export const studyPreferenceSchema = z.object({
  preferredStudyPeriod: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE']),
  typicalSessionMinutes: z.coerce.number().int().min(15).max(240),
  maximumDailyStudyMinutes: z.coerce.number().int().min(30).max(960),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
  notificationsEnabled: z.boolean()
})

export function validationFieldErrors(result) {
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map(issue => [issue.path.at(-1), issue.message]))
}
