import { z } from 'zod'

export const ASSESSMENT_TYPES = ['QUIZ', 'MIDTERM', 'FINAL_EXAMINATION', 'INDIVIDUAL_ASSIGNMENT', 'GROUP_ASSIGNMENT', 'PRESENTATION', 'CLASS_PARTICIPATION', 'ATTENDANCE', 'REFLECTION', 'CASE_ANALYSIS', 'REPORT', 'PROJECT', 'PRACTICAL', 'LABORATORY', 'ORAL_EXAMINATION', 'PEER_ASSESSMENT', 'OTHER']
export const ASSESSMENT_STATUSES = ['NOT_STARTED', 'PLANNING', 'IN_PROGRESS', 'WAITING_ON_TEAMMATE', 'READY_FOR_REVIEW', 'SUBMITTED', 'GRADED', 'OVERDUE', 'CANCELLED']
export const MILESTONE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
export const COURSE_DOCUMENT_TYPES = ['COURSE_OUTLINE', 'ASSESSMENT_BRIEF', 'PRE_CLASS_BRIEFING', 'WEEKLY_SCHEDULE', 'RUBRIC', 'ANNOUNCEMENT', 'SEMINAR_MATERIAL', 'OTHER']
export const COURSE_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']

const optionalText = maximum => z.preprocess(value => value === '' || value === null ? undefined : value, z.string().trim().max(maximum).optional())
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

export const createCourseOutlineImportSchema = z.object({
  originalFileName: optionalText(255),
  mimeType: optionalText(100),
  sourceType: z.enum(['PDF', 'IMAGE', 'TEXT', 'MANUAL']),
  sourceLabel: z.string().trim().min(1).max(255),
  extractedText: z.string().trim().min(20).max(100_000),
  extractionConfidence: nullableNumber(0, 1)
}).strict()

export const createCourseDocumentSchema = z.object({
  documentType: z.enum(COURSE_DOCUMENT_TYPES),
  displayTitle: z.string().trim().min(1).max(255),
  originalFileName: optionalText(255),
  mimeType: z.enum(COURSE_DOCUMENT_MIME_TYPES),
  fileSize: z.coerce.number().int().min(1).max(10 * 1024 * 1024),
  sha256Hash: z.string().regex(/^[a-f0-9]{64}$/i, 'A valid SHA-256 hash is required.'),
  sourceType: z.enum(['PDF', 'IMAGE', 'TEXT']),
  sourceDate: nullableDate,
  extractedText: z.string().trim().min(20).max(100_000),
  extractionConfidence: nullableNumber(0, 1)
}).strict()

export const reviewCourseDocumentSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  decisions: z.array(z.object({
    id: z.string().min(1),
    action: z.enum(['APPROVE', 'REJECT']),
    proposedValue: z.json().optional()
  }).strict()).min(1).max(250)
}).strict()

const candidateFields = {
  status: z.enum(['SELECTED', 'REJECTED']),
  name: nullableText(200),
  type: z.enum(ASSESSMENT_TYPES).nullable().optional(),
  weight: nullableNumber(0, 100),
  officialDeadline: nullableDate,
  eventDate: nullableDate,
  submissionPlatform: nullableText(100),
  submissionUrl: nullableHttpsUrl,
  instructions: nullableText(10_000),
  groupAssessment: z.boolean().nullable().optional(),
  examFormat: nullableText(500),
  durationMinutes: nullableNumber(1, 1440),
  deliverables: z.array(z.string().trim().min(1).max(300)).max(50).optional()
}
const candidateUpdateSchema = z.object({ id: z.string().min(1), ...candidateFields }).strict()
const candidateCreateSchema = z.object({ ...candidateFields, name: z.string().trim().min(1).max(200), type: z.enum(ASSESSMENT_TYPES) }).strict()

export const updateCourseOutlineImportSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  userConfirmedCurrent: z.boolean().optional(),
  candidates: z.array(candidateUpdateSchema).max(100).optional(),
  newCandidates: z.array(candidateCreateSchema).max(25).optional(),
  facts: z.array(z.object({ id: z.string().min(1), value: z.string().trim().max(10_000), selected: z.boolean() }).strict()).max(100).optional(),
  weeks: z.array(z.object({
    id: z.string().min(1),
    weekNumber: nullableNumber(1, 60),
    topic: nullableText(1000),
    reading: nullableText(2000),
    activity: nullableText(2000),
    importantDate: nullableText(500),
    selected: z.boolean()
  }).strict()).max(100).optional()
}).strict()

export const confirmCourseOutlineImportSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true })
}).strict()

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
