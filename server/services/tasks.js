import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { filterTasks, subtaskProgress } from '#shared/tasks/task-intelligence'

const fail = (statusCode, statusMessage, fieldErrors = {}) => { throw createError({ statusCode, statusMessage, data: { fieldErrors } }) }
const taskInclude = {
  moduleEnrolment: { select: { id: true, offering: { select: { module: { select: { code: true, title: true } } } } } },
  assessment: { select: { id: true, name: true, weight: true, officialDeadline: true } },
  recurringCoursework: { select: { id: true, title: true } },
  recurringCourseworkOccurrence: { select: { id: true, sequenceNumber: true, teachingWeek: true, timingNote: true, officialDueAt: true } },
  assessmentMilestone: { select: { id: true, title: true, dueDate: true } },
  subtasks: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  parentTask: { select: { id: true, title: true } }
}
const date = value => value instanceof Date ? value.toISOString() : value ?? null
export function serializeTask(task) {
  const subtasks = (task.subtasks || []).map(item => ({ ...item, dueAt: date(item.dueAt), startedAt: date(item.startedAt), completedAt: date(item.completedAt), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) }))
  return { ...task, dueAt: date(task.dueAt), startedAt: date(task.startedAt), completedAt: date(task.completedAt), createdAt: date(task.createdAt), updatedAt: date(task.updatedAt), assessment: task.assessment ? { ...task.assessment, weight: task.assessment.weight === null ? null : Number(task.assessment.weight), officialDeadline: date(task.assessment.officialDeadline) } : null, subtasks, subtaskProgress: subtaskProgress(subtasks) }
}
async function transaction(database, operation) { return database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 }) }

async function validateLinks(database, userId, input, existing = {}) {
  const ids = { ...existing, ...input }
  const moduleId = ids.moduleEnrolmentId || null
  const checks = await Promise.all([
    moduleId ? database.userModuleEnrolment.findFirst({ where: { id: moduleId, userId }, select: { id: true } }) : null,
    ids.assessmentId ? database.assessment.findFirst({ where: { id: ids.assessmentId, userId }, select: { id: true, userModuleEnrolmentId: true } }) : null,
    ids.recurringCourseworkId ? database.recurringCoursework.findFirst({ where: { id: ids.recurringCourseworkId, userId }, select: { id: true, userModuleEnrolmentId: true } }) : null,
    ids.recurringCourseworkOccurrenceId ? database.recurringCourseworkOccurrence.findFirst({ where: { id: ids.recurringCourseworkOccurrenceId, userId }, select: { id: true, recurringCourseworkId: true, recurringCoursework: { select: { userModuleEnrolmentId: true } } } }) : null,
    ids.assessmentMilestoneId ? database.assessmentMilestone.findFirst({ where: { id: ids.assessmentMilestoneId, assessment: { userId } }, select: { id: true, assessmentId: true, assessment: { select: { userModuleEnrolmentId: true } } } }) : null,
    ids.parentTaskId ? database.task.findFirst({ where: { id: ids.parentTaskId, userId }, select: { id: true, moduleEnrolmentId: true, parentTaskId: true } }) : null
  ])
  const [module, assessment, recurring, occurrence, milestone, parent] = checks
  if (moduleId && !module) fail(400, 'The selected module is unavailable.', { moduleEnrolmentId: 'Select one of your modules.' })
  if (ids.assessmentId && !assessment) fail(400, 'The selected assessment is unavailable.', { assessmentId: 'Select one of your assessments.' })
  if (ids.recurringCourseworkId && !recurring) fail(400, 'The selected coursework is unavailable.', { recurringCourseworkId: 'Select one of your recurring requirements.' })
  if (ids.recurringCourseworkOccurrenceId && !occurrence) fail(400, 'The selected occurrence is unavailable.', { recurringCourseworkOccurrenceId: 'Select one of your coursework occurrences.' })
  if (ids.assessmentMilestoneId && !milestone) fail(400, 'The selected milestone is unavailable.', { assessmentMilestoneId: 'Select one of your milestones.' })
  if (ids.parentTaskId && !parent) fail(400, 'The parent task is unavailable.', { parentTaskId: 'Select one of your tasks.' })
  const linkedModules = [assessment?.userModuleEnrolmentId, recurring?.userModuleEnrolmentId, occurrence?.recurringCoursework?.userModuleEnrolmentId, milestone?.assessment?.userModuleEnrolmentId, parent?.moduleEnrolmentId].filter(Boolean)
  if (moduleId && linkedModules.some(id => id !== moduleId)) fail(400, 'Linked records must belong to the same module.', { moduleEnrolmentId: 'The module does not match the linked source.' })
  if (ids.recurringCourseworkId && occurrence && occurrence.recurringCourseworkId !== ids.recurringCourseworkId) fail(400, 'The occurrence does not belong to the selected coursework.', { recurringCourseworkOccurrenceId: 'Choose a matching occurrence.' })
  if (ids.assessmentId && milestone && milestone.assessmentId !== ids.assessmentId) fail(400, 'The milestone does not belong to the selected assessment.', { assessmentMilestoneId: 'Choose a matching milestone.' })
  return { moduleEnrolmentId: moduleId || linkedModules[0] || null, recurringCourseworkId: ids.recurringCourseworkId || occurrence?.recurringCourseworkId || null, assessmentId: ids.assessmentId || milestone?.assessmentId || null }
}

function data(input) { return Object.fromEntries(['moduleEnrolmentId','assessmentId','recurringCourseworkId','recurringCourseworkOccurrenceId','assessmentMilestoneId','parentTaskId','title','description','type','status','priority','dueAt','timingNote','estimatedMinutes','actualMinutes','sortOrder'].filter(key => input[key] !== undefined).map(key => [key, input[key]])) }
export async function listTasks(userId, filters = {}, database = prisma, now = new Date()) {
  const where = { userId, parentTaskId: null }
  for (const key of ['moduleEnrolmentId','assessmentId','recurringCourseworkId','recurringCourseworkOccurrenceId','type','priority','status']) if (filters[key]) where[key] = filters[key]
  const tasks = await database.task.findMany({ where, include: taskInclude })
  return filterTasks(tasks.map(serializeTask), { view: filters.view, now })
}
export async function getTask(userId, taskId, database = prisma) { const task = await database.task.findFirst({ where: { id: taskId, userId }, include: taskInclude }); if (!task) fail(404, 'Task not found.'); return serializeTask(task) }
export async function createTask(userId, input, database = prisma) {
  try { return await transaction(database, async tx => { const links = await validateLinks(tx, userId, input); const task = await tx.task.create({ data: { ...data(input), ...links, userId }, include: taskInclude }); return serializeTask(task) }) }
  catch (error) { if (error?.code === 'P2002') fail(409, 'A task already exists for this source.'); throw error }
}
export async function updateTask(userId, taskId, input, database = prisma) {
  return transaction(database, async tx => { const current = await tx.task.findFirst({ where: { id: taskId, userId } }); if (!current) fail(404, 'Task not found.'); if (input.parentTaskId === taskId) fail(400, 'A task cannot be its own parent.', { parentTaskId: 'Choose another parent.' }); const links = await validateLinks(tx, userId, input, current); const patch = { ...data(input), ...links }; const now = new Date(); if (input.status === 'IN_PROGRESS' && !current.startedAt) patch.startedAt = now; if (input.status === 'COMPLETED') patch.completedAt = current.completedAt || now; if (input.status && input.status !== 'COMPLETED') patch.completedAt = null; return serializeTask(await tx.task.update({ where: { id: taskId }, data: patch, include: taskInclude })) })
}
export async function setTaskCompleted(userId, taskId, completed, database = prisma) { return updateTask(userId, taskId, { status: completed ? 'COMPLETED' : 'PLANNED' }, database) }
export async function deleteTask(userId, taskId, database = prisma) { const result = await database.task.deleteMany({ where: { id: taskId, userId } }); if (!result.count) fail(404, 'Task not found.'); return { deleted: true } }
export async function createSubtask(userId, parentTaskId, input, database = prisma) { const parent = await database.task.findFirst({ where: { id: parentTaskId, userId } }); if (!parent) fail(404, 'Parent task not found.'); return createTask(userId, { ...input, parentTaskId, moduleEnrolmentId: parent.moduleEnrolmentId, assessmentId: parent.assessmentId, recurringCourseworkId: parent.recurringCourseworkId }, database) }
