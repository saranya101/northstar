import { z } from 'zod'

export const MODULE_COLOURS = ['MINERAL', 'OCEAN', 'FOREST', 'AMBER', 'TERRACOTTA', 'INDIGO', 'SLATE', 'ROSE']
export const INSTRUCTOR_ROLES = ['LECTURER', 'TUTOR', 'SEMINAR_INSTRUCTOR', 'TEACHING_ASSISTANT', 'COORDINATOR', 'OTHER']
export const MODULE_ENROLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'DROPPED', 'ARCHIVED']

const optionalText = maximum => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().max(maximum).optional()
)
const optionalEmail = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.email('Enter a valid lecturer email.').optional()
)
const optionalHttpsUrl = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.url('Enter a valid URL.').refine(value => value.startsWith('https://'), 'Use a secure HTTPS URL.').optional()
)
const optionalAcademicUnits = z.preprocess(
  value => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number().gt(0, 'Academic units must be greater than zero.').max(30, 'Academic units cannot exceed 30.').optional()
)

export function normalizeModuleCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value
}

export function normalizeSectionLabel(value) {
  const section = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return section || 'DEFAULT'
}

const moduleCodeSchema = z.preprocess(
  normalizeModuleCode,
  z.string().min(2, 'Module code must be at least 2 characters.').max(20, 'Module code must be 20 characters or fewer.').regex(/^[A-Z0-9][A-Z0-9 ._/-]*$/, 'Enter a valid module code.')
)
const sectionLabelSchema = optionalText(50)
const targetGradeSchema = optionalText(10)
const clearableTargetGradeSchema = z.preprocess(
  value => value === '' || value === null ? null : value,
  z.string().trim().max(10).nullable().optional()
)
const clearablePersonalNotesSchema = z.preprocess(
  value => value === '' || value === null ? null : value,
  z.string().trim().max(5000).nullable().optional()
)

export const createManualModuleSchema = z.object({
  code: moduleCodeSchema,
  title: z.string().trim().min(2, 'Module title must be at least 2 characters.').max(160, 'Module title must be 160 characters or fewer.'),
  description: optionalText(2000),
  academicUnits: optionalAcademicUnits,
  sectionLabel: sectionLabelSchema,
  targetGrade: targetGradeSchema,
  colour: z.enum(MODULE_COLOURS, { error: 'Select a valid module colour.' }),
  lecturerName: optionalText(160),
  lecturerRole: z.enum(INSTRUCTOR_ROLES, { error: 'Select a valid lecturer role.' }).default('LECTURER'),
  lecturerTitle: optionalText(100),
  lecturerEmail: optionalEmail,
  lecturerProfileUrl: optionalHttpsUrl
}).strict()

export const enrolExistingModuleSchema = z.object({
  moduleId: z.string().trim().min(1, 'Select a module.'),
  sectionLabel: sectionLabelSchema,
  targetGrade: targetGradeSchema,
  colour: z.enum(MODULE_COLOURS, { error: 'Select a valid module colour.' })
}).strict()

export const updateModuleEnrolmentSchema = z.object({
  targetGrade: clearableTargetGradeSchema,
  colour: z.enum(MODULE_COLOURS, { error: 'Select a valid module colour.' }).optional(),
  personalNotes: clearablePersonalNotesSchema,
  status: z.enum(MODULE_ENROLMENT_STATUSES, { error: 'Select a valid enrolment status.' }).optional()
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'Provide at least one field to update.'
})

export const createInstructorSchema = z.object({
  fullName: z.string().trim().min(2, 'Instructor name must be at least 2 characters.').max(160, 'Instructor name must be 160 characters or fewer.'),
  role: z.enum(INSTRUCTOR_ROLES, { error: 'Select a valid instructor role.' }),
  title: optionalText(100),
  officialEmail: optionalEmail,
  officialProfileUrl: optionalHttpsUrl
}).strict()

export const moduleSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters.').max(100, 'Search must be 100 characters or fewer.')
})

export const moduleListQuerySchema = z.object({
  status: z.enum(MODULE_ENROLMENT_STATUSES).optional().default('ACTIVE')
})

export const moduleDeleteQuerySchema = z.object({
  mode: z.enum(['drop', 'archive']).optional().default('drop')
})
