import { z } from 'zod'

export const PREPARATION_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']
export const PREPARATION_STATUS_FIELDS = ['materialStatus', 'notesStatus', 'requiredWorkStatus', 'practiceStatus']

export const teachingWeekSchema = z.coerce.number().int().min(1).max(52)

export const updatePreparationSchema = z.object({
  materialStatus: z.enum(PREPARATION_STATUSES).optional(),
  notesStatus: z.enum(PREPARATION_STATUSES).optional(),
  requiredWorkStatus: z.enum(PREPARATION_STATUSES).optional(),
  practiceStatus: z.enum(PREPARATION_STATUSES).optional(),
  questions: z.preprocess(value => value === '' ? null : value, z.string().trim().max(5000).nullable()).optional()
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Provide at least one preparation change.' })
