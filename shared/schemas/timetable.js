import { z } from 'zod'

export const TIMETABLE_IMPORT_SOURCES = ['PASTED_TEXT', 'UNKNOWN']
export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
export const CLASS_SESSION_TYPES = ['LECTURE', 'TUTORIAL', 'SEMINAR', 'LABORATORY', 'WORKSHOP', 'PROJECT', 'FIELDWORK', 'OTHER']
export const SESSION_RECURRENCES = ['WEEKLY', 'ODD_WEEKS', 'EVEN_WEEKS', 'CUSTOM']
export const REGISTRATION_STATUSES = ['REGISTERED', 'WAITLISTED', 'EXEMPTED', 'UNKNOWN']
export const SESSION_DELIVERY_MODES = ['IN_PERSON', 'ONLINE', 'HYBRID', 'TBC', 'UNKNOWN']
export const MODULE_VERIFICATION_STATUSES = ['USER_CONFIRMED', 'PUBLIC_SOURCE_MATCH', 'PUBLIC_SOURCE_CONFLICT', 'UNVERIFIED']

const emptyToNull = value => typeof value === 'string' && value.trim() === '' ? null : value
const nullableText = maximum => z.preprocess(emptyToNull, z.string().trim().max(maximum).nullable().optional().default(null))
const confidenceSchema = z.coerce.number().min(0).max(1)
const candidateIdSchema = z.string().trim().min(1).max(100)
const minuteSchema = z.coerce.number().int().min(0).max(1440)
const startMinuteSchema = z.coerce.number().int().min(0).max(1439)
const endMinuteSchema = z.coerce.number().int().min(1).max(1440)
const weekNumbersSchema = z.array(z.coerce.number().int().min(1).max(20)).max(20).transform(values => [...new Set(values)].sort((a, b) => a - b))
const sourceSemesterSchema = z.object({
  academicYearStart: z.coerce.number().int().min(2000).max(2200),
  academicYearLabel: z.string().regex(/^\d{4}\/\d{4}$/),
  semesterNumber: z.coerce.number().int().min(1).max(4),
  displayLabel: z.string().trim().min(1).max(80)
}).strict()
const examCandidateSchema = z.object({
  applicable: z.boolean(),
  rawText: z.string().trim().max(200),
  date: z.iso.date().nullable(),
  startMinutes: startMinuteSchema.nullable(),
  endMinutes: endMinuteSchema.nullable(),
  confidence: confidenceSchema
}).strict().superRefine((value, context) => { if (value.startMinutes !== null && value.endMinutes !== null && value.endMinutes <= value.startMinutes) context.addIssue({ code: 'custom', path: ['endMinutes'], message: 'Exam end time must be after its start time.' }) })
const timeAlternativeSchema = z.object({
  source: z.enum(['EXPLICIT_TEXT']),
  startMinutes: startMinuteSchema.nullable(),
  endMinutes: endMinuteSchema.nullable(),
  confidence: confidenceSchema.nullable().default(null),
  label: z.string().trim().min(1).max(100).optional(),
  reason: z.string().trim().min(1).max(200).optional(),
  warnings: z.array(z.string().trim().min(1).max(200)).max(10).default([])
}).strict().superRefine((value, context) => { if (value.startMinutes !== null && value.endMinutes !== null && value.endMinutes <= value.startMinutes) context.addIssue({ code: 'custom', path: ['endMinutes'], message: 'Alternative end time must be after its start time.' }) })
const correctionSchema = z.object({ original: z.string().trim().min(1).max(80), corrected: z.string().trim().min(1).max(80), reason: z.string().trim().min(1).max(200) }).strict()
const originalSessionValueSchema = z.union([z.string().max(200), z.number(), z.array(z.coerce.number().int().min(1).max(20)).max(20), z.null()])

const enrichmentFieldSchema = z.object({
  sourceUrl: z.url().refine(value => ['www.ntu.edu.sg', 'wish.wis.ntu.edu.sg'].includes(new URL(value).hostname), 'Use an approved public NTU source.'),
  sourceType: z.enum(['NTU_CLASS_SCHEDULE', 'NTU_CONTENT_OF_COURSES', 'NTU_SCHOOL_COURSE_PAGE']),
  fetchedAt: z.iso.datetime(),
  academicYear: z.string().trim().min(1).max(30),
  semester: z.string().trim().min(1).max(40),
  confidence: confidenceSchema,
  verificationStatus: z.enum(MODULE_VERIFICATION_STATUSES)
}).strict()

const publicEnrichmentSchema = z.object({
  title: nullableText(160),
  academicUnits: z.number().gt(0).max(30).nullable().default(null),
  description: nullableText(5000),
  gradingBasis: nullableText(100),
  school: nullableText(200),
  officialUrl: z.url().nullable().default(null),
  fieldProvenance: z.record(z.string(), enrichmentFieldSchema),
  verificationStatus: z.enum(MODULE_VERIFICATION_STATUSES)
}).strict()

export const timetableSessionCandidateSchema = z.object({
  candidateId: candidateIdSchema,
  blockId: nullableText(120),
  moduleAssignmentConfirmed: z.boolean().default(true),
  fieldSources: z.record(z.string().max(40), z.enum(['EXTRACTED', 'INFERRED', 'MANUAL'])).default({}),
  originalValues: z.record(z.string().max(40), originalSessionValueSchema).default({}),
  classType: z.enum(CLASS_SESSION_TYPES).default('OTHER'),
  groupLabel: z.string().trim().max(100).transform(value => value || 'DEFAULT').default('DEFAULT'),
  dayOfWeek: z.enum(DAYS_OF_WEEK).nullable(),
  startMinutes: startMinuteSchema.nullable(),
  endMinutes: endMinuteSchema.nullable(),
  timeConfirmed: z.boolean().default(false),
  timeAlternatives: z.array(timeAlternativeSchema).max(5).default([]),
  venue: nullableText(200),
  deliveryMode: z.enum(SESSION_DELIVERY_MODES).default('UNKNOWN'),
  deliveryModeConfirmed: z.boolean().default(true),
  recurrence: z.enum(SESSION_RECURRENCES).default('WEEKLY'),
  recurrenceConfirmed: z.boolean().default(true),
  weekNumbers: weekNumbersSchema.default([]),
  confidence: confidenceSchema,
  selected: z.boolean().default(true),
  warnings: z.array(z.string().trim().min(1).max(200)).max(20).default([])
}).strict().superRefine((value, context) => {
  if (value.recurrence !== 'CUSTOM' && value.weekNumbers.length) context.addIssue({ code: 'custom', path: ['weekNumbers'], message: 'Only custom recurrence can specify week numbers.' })
  if (value.recurrence === 'CUSTOM' && !value.weekNumbers.length) context.addIssue({ code: 'custom', path: ['weekNumbers'], message: 'Choose at least one week.' })
  if (value.startMinutes !== null && value.startMinutes > 1439) context.addIssue({ code: 'custom', path: ['startMinutes'], message: 'Start time must be before midnight.' })
  if (value.endMinutes !== null && value.endMinutes < 1) context.addIssue({ code: 'custom', path: ['endMinutes'], message: 'Enter a valid end time.' })
  if (value.startMinutes !== null && value.endMinutes !== null && value.endMinutes <= value.startMinutes) context.addIssue({ code: 'custom', path: ['endMinutes'], message: 'End time must be after start time.' })
})

export const timetableModuleCandidateSchema = z.object({
  candidateId: candidateIdSchema,
  code: z.string().trim().transform(value => value.toUpperCase()).pipe(z.string().min(2).max(20)),
  title: nullableText(160),
  academicUnits: z.preprocess(value => value === '' || value === null || value === undefined ? null : value, z.coerce.number().gt(0).max(30).nullable()),
  indexNumber: nullableText(20),
  courseType: nullableText(100),
  registrationStatus: z.enum(REGISTRATION_STATUSES).default('UNKNOWN'),
  confidence: confidenceSchema,
  selected: z.boolean().default(true),
  sessions: z.array(timetableSessionCandidateSchema).max(100).default([]),
  examCandidate: examCandidateSchema.nullable().default(null),
  fieldProvenance: z.record(z.string(), z.enum(['REGISTERED_COURSE_TABLE', 'TIMETABLE_GRID', 'STRUCTURED_TEXT', 'NTU_PUBLIC', 'USER_CORRECTION'])).default({}),
  corrections: z.array(correctionSchema).max(20).default([]),
  publicEnrichment: publicEnrichmentSchema.nullable().optional().default(null),
  publicEnrichmentConfirmed: z.boolean().default(true),
  titleNeedsReview: z.boolean().default(false)
}).strict()

export const timetableCandidateSchema = z.object({
  source: z.enum(TIMETABLE_IMPORT_SOURCES),
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100),
  sourceSemester: sourceSemesterSchema.nullable().default(null),
  sourceSummary: z.object({ moduleCount: z.coerce.number().int().min(0).max(100).nullable(), totalAcademicUnits: z.coerce.number().min(0).max(500).nullable() }).strict().nullable().default(null),
  structure: z.object({
    gridVisible: z.boolean(),
    gridModuleCodes: z.array(z.string().regex(/^[A-Z]{2}\d{4}$/)).max(100),
    physicalBlockIds: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
    unresolvedBlockIds: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
    duplicateSessionBlockCount: z.coerce.number().int().min(0).max(100).default(0),
    detectedSessionBlocks: z.record(z.string().regex(/^[A-Z]{2}\d{4}$/), z.coerce.number().int().min(0).max(100)).default({}),
    detectedSessionBlockCount: z.coerce.number().int().min(0).max(100).default(0),
    droppedSessionBlockCount: z.coerce.number().int().min(0).max(100).default(0),
    examRowsDetected: z.coerce.number().int().min(0).max(100),
    examRowsReconstructed: z.coerce.number().int().min(0).max(100).default(0)
  }).strict().nullable().default(null),
  unmatchedTimetableText: z.array(z.object({
    candidateId: candidateIdSchema,
    blockId: nullableText(120),
    text: z.string().trim().min(1).max(1000),
    sessionCandidate: timetableSessionCandidateSchema.nullable().default(null),
    selected: z.boolean().default(false),
    attachToCandidateId: candidateIdSchema.nullable().default(null),
    warnings: z.array(z.string().trim().min(1).max(200)).max(10).default([])
  }).strict()).max(100).default([]),
  segmentation: z.object({ confidence: confidenceSchema, warnings: z.array(z.string().trim().min(1).max(200)).max(20).default([]) }).strict().nullable().default(null),
  warnings: z.array(z.string().trim().min(1).max(200)).max(50).default([])
}).strict()

export const createTimetableImportSchema = timetableCandidateSchema
export const updateTimetableImportSchema = z.object({
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100),
  unmatchedTimetableText: timetableCandidateSchema.shape.unmatchedTimetableText,
  warnings: z.array(z.string().trim().min(1).max(200)).max(50).default([])
}).strict()

export const confirmTimetableImportSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100)
}).strict().superRefine((value, context) => {
  for (const [index, module] of value.modules.entries()) {
    if (module.selected && !module.publicEnrichmentConfirmed) context.addIssue({ code: 'custom', path: ['modules', index, 'publicEnrichment'], message: 'Resolve the public-source discrepancy.' })
    for (const [sessionIndex, session] of module.sessions.entries()) {
      if (!module.selected || !session.selected) continue
      if (!session.moduleAssignmentConfirmed) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'moduleAssignmentConfirmed'], message: 'Choose the registered module for this class block.' })
      if (!session.dayOfWeek) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'dayOfWeek'], message: 'Choose a day.' })
      if (session.startMinutes === null) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'startMinutes'], message: 'Enter a start time.' })
      if (session.endMinutes === null) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'endMinutes'], message: 'Enter an end time.' })
      const hasTimeConflict = session.warnings.some(warning => /time.*(?:conflict|uncertain|confirmation)|(?:conflict|uncertain).*time/i.test(warning))
      if (!session.timeConfirmed && (session.timeAlternatives.length > 0 || hasTimeConflict || session.startMinutes === null || session.endMinutes === null)) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'startMinutes'], message: session.timeAlternatives.length ? 'Choose one of the detected time alternatives.' : 'Confirm the uncertain time.' })
      if (!session.deliveryModeConfirmed) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'deliveryMode'], message: 'Confirm the delivery mode.' })
      if (!session.recurrenceConfirmed) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'recurrence'], message: 'Confirm the week pattern.' })
    }
  }
})

const classSessionFields = {
  classType: z.enum(CLASS_SESSION_TYPES),
  groupLabel: z.string().trim().max(100).transform(value => value || 'DEFAULT').default('DEFAULT'),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  startMinutes: minuteSchema.refine(value => value <= 1439),
  endMinutes: minuteSchema.refine(value => value >= 1),
  venue: nullableText(200),
  deliveryMode: z.enum(SESSION_DELIVERY_MODES).default('UNKNOWN'),
  recurrence: z.enum(SESSION_RECURRENCES).default('WEEKLY'),
  weekNumbers: weekNumbersSchema.default([])
}

function validateSession(value, context) {
  if (value.endMinutes <= value.startMinutes) context.addIssue({ code: 'custom', path: ['endMinutes'], message: 'End time must be after start time.' })
  if (value.recurrence !== 'CUSTOM' && value.weekNumbers?.length) context.addIssue({ code: 'custom', path: ['weekNumbers'], message: 'Only custom recurrence can specify week numbers.' })
  if (value.recurrence === 'CUSTOM' && !value.weekNumbers?.length) context.addIssue({ code: 'custom', path: ['weekNumbers'], message: 'Choose at least one week.' })
}

export const classSessionCreateSchema = z.object(classSessionFields).strict().superRefine(validateSession)
export const classSessionUpdateSchema = z.object(Object.fromEntries(Object.entries(classSessionFields).map(([key, schema]) => [key, schema.optional()]))).strict()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one field to update.')
  .superRefine((value, context) => {
    if (value.startMinutes !== undefined && value.endMinutes !== undefined) validateSession(value, context)
    if (value.recurrence === 'CUSTOM' && !value.weekNumbers?.length) context.addIssue({ code: 'custom', path: ['weekNumbers'], message: 'Choose at least one week.' })
  })

export const ntuEnrichmentQuerySchema = z.object({
  code: z.string().trim().transform(value => value.toUpperCase()).pipe(z.string().min(2).max(20).regex(/^(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+$/)),
  academicYear: z.string().trim().min(4).max(30),
  semester: z.string().trim().min(1).max(40),
  indexNumber: nullableText(20),
  importedTitle: nullableText(160)
}).strict()
