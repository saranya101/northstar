import { z } from 'zod'

export const RECURRING_COURSEWORK_TYPES = ['LAMS', 'ONLINE_ASSIGNMENT', 'QUIZ', 'READING', 'TUTORIAL_PREPARATION', 'SEMINAR_PREPARATION', 'PARTICIPATION', 'OTHER']
export const RECURRING_COURSEWORK_FREQUENCIES = ['WEEKLY', 'FORTNIGHTLY', 'CUSTOM']
export const RECURRING_COURSEWORK_STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED']
export const RECURRING_OCCURRENCE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'MISSED', 'EXCUSED']

const nullableText = maximum => z.preprocess(value => value === '' || value === undefined ? null : value, z.string().trim().max(maximum).nullable().optional())
const nullableNumber = (minimum, maximum) => z.preprocess(value => value === '' || value === null || value === undefined ? null : value, z.coerce.number().min(minimum).max(maximum).nullable().optional())
const nullableInteger = (minimum, maximum) => z.preprocess(value => value === '' || value === null || value === undefined ? null : value, z.coerce.number().int().min(minimum).max(maximum).nullable().optional())
const patchNullableText = maximum => z.preprocess(value => value === '' ? null : value, z.string().trim().max(maximum).nullable()).optional()
const patchNullableNumber = (minimum, maximum) => z.preprocess(value => value === '' || value === null ? null : value, z.coerce.number().min(minimum).max(maximum).nullable()).optional()
const patchNullableInteger = (minimum, maximum) => z.preprocess(value => value === '' || value === null ? null : value, z.coerce.number().int().min(minimum).max(maximum).nullable()).optional()
const patchNullableDate = z.preprocess(value => value === '' || value === null ? null : value, z.iso.datetime({ offset: true }).nullable()).optional()

const requirementShape = {
  title: z.string().trim().min(1).max(200),
  type: z.enum(RECURRING_COURSEWORK_TYPES),
  description: nullableText(5000),
  frequency: z.enum(RECURRING_COURSEWORK_FREQUENCIES),
  totalExpected: z.coerce.number().int().min(1).max(100),
  firstTeachingWeek: nullableInteger(1, 60),
  lastTeachingWeek: nullableInteger(1, 60),
  recessWeeks: z.array(z.coerce.number().int().min(1).max(60)).max(10).default([]),
  includeRecessWeeks: z.boolean().default(false),
  graded: z.boolean().default(false),
  totalAssessmentWeight: nullableNumber(0, 100),
  completeBeforeClass: z.boolean().default(false),
  timingNote: nullableText(500),
  assessmentId: nullableText(100)
}

function validateRequirement(value, context) {
  if (value.firstTeachingWeek !== undefined && value.lastTeachingWeek !== undefined && (value.firstTeachingWeek === null) !== (value.lastTeachingWeek === null)) context.addIssue({ code: 'custom', path: ['lastTeachingWeek'], message: 'Provide both the first and last teaching week.' })
  if (value.firstTeachingWeek !== null && value.firstTeachingWeek !== undefined && value.lastTeachingWeek !== null && value.lastTeachingWeek !== undefined && value.firstTeachingWeek > value.lastTeachingWeek) context.addIssue({ code: 'custom', path: ['lastTeachingWeek'], message: 'Last teaching week must not be before the first.' })
  if (value.graded === false && value.totalAssessmentWeight !== null && value.totalAssessmentWeight !== undefined) context.addIssue({ code: 'custom', path: ['totalAssessmentWeight'], message: 'Only graded coursework can have an assessment weight.' })
}

export const createRecurringCourseworkSchema = z.object(requirementShape).strict().superRefine(validateRequirement)

export const updateRecurringCourseworkSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(RECURRING_COURSEWORK_TYPES).optional(),
  description: patchNullableText(5000),
  frequency: z.enum(RECURRING_COURSEWORK_FREQUENCIES).optional(),
  totalExpected: z.coerce.number().int().min(1).max(100).optional(),
  firstTeachingWeek: patchNullableInteger(1, 60),
  lastTeachingWeek: patchNullableInteger(1, 60),
  recessWeeks: z.array(z.coerce.number().int().min(1).max(60)).max(10).optional(),
  includeRecessWeeks: z.boolean().optional(),
  graded: z.boolean().optional(),
  totalAssessmentWeight: patchNullableNumber(0, 100),
  completeBeforeClass: z.boolean().optional(),
  timingNote: patchNullableText(500),
  assessmentId: patchNullableText(100),
  status: z.enum(RECURRING_COURSEWORK_STATUSES).optional(),
  removeIncompleteOccurrences: z.boolean().optional()
}).strict().superRefine(validateRequirement)

export const generateRecurringOccurrencesSchema = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict()

function validateScore(value, context) {
  const hasScore = value.score !== null && value.score !== undefined
  const hasMaximum = value.maximumScore !== null && value.maximumScore !== undefined
  if (hasScore !== hasMaximum) context.addIssue({ code: 'custom', path: ['score'], message: 'Score and maximum score must be provided together.' })
  if (hasScore && value.score > value.maximumScore) context.addIssue({ code: 'custom', path: ['score'], message: 'Score cannot exceed the maximum score.' })
}

export const updateRecurringOccurrenceSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  status: z.enum(RECURRING_OCCURRENCE_STATUSES).optional(),
  officialDueAt: patchNullableDate,
  timingNote: patchNullableText(500),
  privateNotes: patchNullableText(5000),
  score: patchNullableNumber(0, 1_000_000),
  maximumScore: patchNullableNumber(0.01, 1_000_000)
}).strict().superRefine(validateScore)

export const updateSubmissionVerificationSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  workCompleted: z.boolean().optional(),
  finalConfirmationClicked: z.boolean().optional(),
  gradeCentreChecked: z.boolean().optional(),
  markCaptured: z.boolean().optional(),
  submissionReference: patchNullableText(255),
  score: patchNullableNumber(0, 1_000_000),
  maximumScore: patchNullableNumber(0.01, 1_000_000)
}).strict().superRefine(validateScore)
