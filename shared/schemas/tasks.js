import { z } from 'zod'

export const TASK_TYPES = ['STUDY', 'REVISION', 'ASSIGNMENT', 'READING', 'PRACTICE', 'ADMIN', 'GROUP_WORK', 'OTHER']
export const TASK_STATUSES = ['BACKLOG', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const blank = value => value === '' || value === null || value === undefined ? undefined : value
const text = maximum => z.preprocess(blank, z.string().trim().min(1).max(maximum).optional())
const integer = maximum => z.preprocess(blank, z.coerce.number().int().min(0).max(maximum).optional())
const date = z.preprocess(blank, z.iso.datetime({ offset: true }).optional())

const mutable = {
  moduleEnrolmentId: text(100), assessmentId: text(100), recurringCourseworkId: text(100), recurringCourseworkOccurrenceId: text(100), assessmentMilestoneId: text(100), parentTaskId: text(100),
  title: z.string().trim().min(1).max(240), description: text(5000), type: z.enum(TASK_TYPES), status: z.enum(TASK_STATUSES), priority: z.enum(TASK_PRIORITIES), dueAt: date, timingNote: text(500), estimatedMinutes: integer(100_000), actualMinutes: integer(1_000_000), sortOrder: integer(10_000)
}

export const createTaskSchema = z.object({ ...mutable, type: mutable.type.default('STUDY'), status: mutable.status.default('BACKLOG'), priority: mutable.priority.default('MEDIUM') }).strict()
const patchText = maximum => z.preprocess(value => value === '' ? null : value, z.string().trim().min(1).max(maximum).nullable()).optional()
const patchInteger = maximum => z.preprocess(value => value === '' ? null : value, z.coerce.number().int().min(0).max(maximum).nullable()).optional()
const patchDate = z.preprocess(value => value === '' ? null : value, z.iso.datetime({ offset: true }).nullable()).optional()
export const updateTaskSchema = z.object({
  moduleEnrolmentId: patchText(100), assessmentId: patchText(100), recurringCourseworkId: patchText(100), recurringCourseworkOccurrenceId: patchText(100), assessmentMilestoneId: patchText(100), parentTaskId: patchText(100),
  title: mutable.title.optional(), description: patchText(5000), type: mutable.type.optional(), status: mutable.status.optional(), priority: mutable.priority.optional(), dueAt: patchDate, timingNote: patchText(500), estimatedMinutes: patchInteger(100_000), actualMinutes: patchInteger(1_000_000), sortOrder: patchInteger(10_000)
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Provide at least one change.' })
export const createSubtaskSchema = createTaskSchema.omit({ parentTaskId: true, moduleEnrolmentId: true, assessmentId: true, recurringCourseworkId: true, recurringCourseworkOccurrenceId: true, assessmentMilestoneId: true }).extend({ title: mutable.title })
export const completeTaskSchema = z.object({ completed: z.boolean() }).strict()
export const taskListQuerySchema = z.object({ view: z.enum(['TODAY', 'OVERDUE', 'UPCOMING', 'BACKLOG', 'COMPLETED', 'ALL']).default('ALL'), moduleEnrolmentId: text(100), assessmentId: text(100), recurringCourseworkId: text(100), recurringCourseworkOccurrenceId: text(100), type: z.enum(TASK_TYPES).optional(), priority: z.enum(TASK_PRIORITIES).optional(), status: z.enum(TASK_STATUSES).optional() }).strict()
