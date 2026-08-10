import { z } from 'zod'

export const ASSESSMENT_TYPES = ['QUIZ', 'MIDTERM', 'FINAL_EXAMINATION', 'INDIVIDUAL_ASSIGNMENT', 'GROUP_ASSIGNMENT', 'PRESENTATION', 'CLASS_PARTICIPATION', 'ATTENDANCE', 'REFLECTION', 'CASE_ANALYSIS', 'REPORT', 'PROJECT', 'PRACTICAL', 'LABORATORY', 'ORAL_EXAMINATION', 'PEER_ASSESSMENT', 'OTHER']
export const ASSESSMENT_STATUSES = ['NOT_STARTED', 'PLANNING', 'IN_PROGRESS', 'WAITING_ON_TEAMMATE', 'READY_FOR_REVIEW', 'SUBMITTED', 'GRADED', 'OVERDUE', 'CANCELLED']
export const MILESTONE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const nullableText = maximum => z.preprocess(value => value === '' || value === undefined ? null : value, z.string().trim().max(maximum).nullable().optional())
const nullableNumber = (minimum, maximum) => z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.coerce.number().min(minimum).max(maximum).nullable().optional()
)
const nullableDate = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.iso.datetime({ offset: true }).nullable().optional()
)
const nullableHttpsUrl = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.url().refine(value => value.startsWith('https://'), 'Use a secure HTTPS URL.').nullable().optional()
)

const assessmentShape = {
  name: z.string().trim().min(1).max(200),
  type: z.enum(ASSESSMENT_TYPES),
  weight: nullableNumber(0, 100),
  officialDeadline: nullableDate,
  internalDeadline: nullableDate,
  eventDate: nullableDate,
  submissionPlatform: nullableText(100),
  submissionUrl: nullableHttpsUrl,
  instructions: nullableText(10_000),
  examFormat: nullableText(500),
  estimatedEffortMinutes: nullableNumber(0, 100_000),
  actualEffortMinutes: nullableNumber(0, 100_000),
  groupAssessment: z.boolean().nullable().optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  score: nullableNumber(0, 1_000_000),
  maximumScore: nullableNumber(0.01, 1_000_000),
  feedback: nullableText(10_000),
  reflection: nullableText(10_000),
  submittedAt: nullableDate,
  gradedAt: nullableDate
}
function validateAssessment(value, context) {
  const hasScore = value.score !== null && value.score !== undefined
  const hasMaximum = value.maximumScore !== null && value.maximumScore !== undefined
  if (hasScore !== hasMaximum) context.addIssue({ code: 'custom', message: 'Score and maximum score must be provided together.', path: ['score'] })
  if (value.score !== null && value.maximumScore !== null && value.score > value.maximumScore) context.addIssue({ code: 'custom', message: 'Score cannot exceed the maximum score.', path: ['score'] })
  if (value.internalDeadline && value.officialDeadline && new Date(value.internalDeadline) > new Date(value.officialDeadline)) context.addIssue({ code: 'custom', message: 'Internal deadline must not be after the official deadline.', path: ['internalDeadline'] })
}
export const assessmentInputSchema = z.object(assessmentShape).strict().superRefine(validateAssessment)

export const updateAssessmentSchema = z.object(assessmentShape).partial().strict().superRefine(validateAssessment).refine(value => Object.keys(value).length > 0, 'Provide at least one field to update.')

export const updateGradeTargetSchema = z.object({
  targetPercentage: nullableNumber(0, 100),
  targetLabel: nullableText(50)
}).strict()

export const createDeliverableSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: nullableText(2000),
  required: z.boolean().optional(),
  completed: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional()
}).strict()
export const updateDeliverableSchema = createDeliverableSchema.partial().refine(value => Object.keys(value).length > 0)

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueDate: nullableDate,
  status: z.enum(MILESTONE_STATUSES).optional(),
  estimatedEffortMinutes: nullableNumber(0, 100_000),
  notes: nullableText(5000),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional()
}).strict()
export const updateMilestoneSchema = createMilestoneSchema.partial().refine(value => Object.keys(value).length > 0)
