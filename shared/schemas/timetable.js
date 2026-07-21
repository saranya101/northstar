import { z } from 'zod'

export const TIMETABLE_IMPORT_SOURCES = ['NTU_REGISTERED_COURSES_PDF', 'NTU_REGISTERED_COURSES_IMAGE', 'NTU_TIMETABLE_IMAGE', 'PASTED_TEXT', 'UNKNOWN']
export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
export const CLASS_SESSION_TYPES = ['LECTURE', 'TUTORIAL', 'SEMINAR', 'LABORATORY', 'WORKSHOP', 'PROJECT', 'FIELDWORK', 'OTHER']
export const SESSION_RECURRENCES = ['WEEKLY', 'ODD_WEEKS', 'EVEN_WEEKS', 'CUSTOM']
export const REGISTRATION_STATUSES = ['REGISTERED', 'WAITLISTED', 'EXEMPTED', 'UNKNOWN']

const emptyToNull = value => typeof value === 'string' && value.trim() === '' ? null : value
const nullableText = maximum => z.preprocess(emptyToNull, z.string().trim().max(maximum).nullable().optional().default(null))
const confidenceSchema = z.coerce.number().min(0).max(1)
const candidateIdSchema = z.string().trim().min(1).max(100)
const minuteSchema = z.coerce.number().int().min(0).max(1440)
const weekNumbersSchema = z.array(z.coerce.number().int().min(1).max(52)).max(52).transform(values => [...new Set(values)].sort((a, b) => a - b))

export const timetableSessionCandidateSchema = z.object({
  candidateId: candidateIdSchema,
  classType: z.enum(CLASS_SESSION_TYPES).default('OTHER'),
  groupLabel: z.string().trim().max(100).transform(value => value || 'DEFAULT').default('DEFAULT'),
  dayOfWeek: z.enum(DAYS_OF_WEEK).nullable(),
  startMinutes: minuteSchema.nullable(),
  endMinutes: minuteSchema.nullable(),
  venue: nullableText(200),
  recurrence: z.enum(SESSION_RECURRENCES).default('WEEKLY'),
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
  sessions: z.array(timetableSessionCandidateSchema).max(100).default([])
}).strict()

export const timetableCandidateSchema = z.object({
  source: z.enum(TIMETABLE_IMPORT_SOURCES),
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100),
  warnings: z.array(z.string().trim().min(1).max(200)).max(50).default([])
}).strict()

export const createTimetableImportSchema = timetableCandidateSchema
export const updateTimetableImportSchema = z.object({
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100),
  warnings: z.array(z.string().trim().min(1).max(200)).max(50).default([])
}).strict()

export const confirmTimetableImportSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  modules: z.array(timetableModuleCandidateSchema).min(1).max(100)
}).strict().superRefine((value, context) => {
  for (const [index, module] of value.modules.entries()) {
    for (const [sessionIndex, session] of module.sessions.entries()) {
      if (!module.selected || !session.selected) continue
      if (!session.dayOfWeek) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'dayOfWeek'], message: 'Choose a day.' })
      if (session.startMinutes === null) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'startMinutes'], message: 'Enter a start time.' })
      if (session.endMinutes === null) context.addIssue({ code: 'custom', path: ['modules', index, 'sessions', sessionIndex, 'endMinutes'], message: 'Enter an end time.' })
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
