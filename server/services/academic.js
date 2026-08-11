import { createError } from 'h3'
import { prisma } from '../utils/prisma'

const domainError = (statusCode, statusMessage, data) => createError({ statusCode, statusMessage, data })
const decimal = value => value === null || value === undefined ? null : Number(value)
const date = value => value instanceof Date ? value.toISOString() : value ?? null
export const normalizeAssessmentName = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

async function requireEnrolment(database, userId, enrolmentId) {
  const enrolment = await database.userModuleEnrolment.findFirst({ where: { id: enrolmentId, userId } })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  return enrolment
}

function assessmentData(input) {
  const score = decimal(input.score)
  const maximumScore = decimal(input.maximumScore)
  const weight = decimal(input.weight)
  const percentageScore = score !== null && maximumScore ? score / maximumScore * 100 : null
  const allowed = ['name', 'type', 'weight', 'officialDeadline', 'internalDeadline', 'eventDate', 'eventEndDate', 'submissionPlatform', 'submissionUrl', 'instructions', 'examFormat', 'estimatedEffortMinutes', 'actualEffortMinutes', 'groupAssessment', 'status', 'score', 'maximumScore', 'feedback', 'reflection', 'submittedAt', 'gradedAt']
  return {
    ...Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key, input[key]])),
    normalizedName: normalizeAssessmentName(input.name), percentageScore,
    weightedScore: percentageScore !== null && weight !== null ? percentageScore * weight / 100 : null,
    status: input.status || (percentageScore !== null ? 'GRADED' : 'NOT_STARTED')
  }
}

export function serializeAssessment(value) {
  return {
    ...value, weight: decimal(value.weight), score: decimal(value.score), maximumScore: decimal(value.maximumScore),
    percentageScore: decimal(value.percentageScore), weightedScore: decimal(value.weightedScore),
    officialDeadline: date(value.officialDeadline), internalDeadline: date(value.internalDeadline), eventDate: date(value.eventDate), eventEndDate: date(value.eventEndDate),
    submittedAt: date(value.submittedAt), gradedAt: date(value.gradedAt), createdAt: date(value.createdAt), updatedAt: date(value.updatedAt),
    milestones: value.milestones?.map(item => ({ ...item, dueDate: date(item.dueDate), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) || [],
    deliverables: value.deliverables || []
  }
}

const assessmentInclude = {
  deliverables: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
}

export async function listAssessments(userId, enrolmentId, database = prisma) {
  const enrolment = await requireEnrolment(database, userId, enrolmentId)
  const assessments = await database.assessment.findMany({ where: { userId, userModuleEnrolmentId: enrolmentId }, include: assessmentInclude, orderBy: [{ officialDeadline: 'asc' }, { createdAt: 'asc' }] })
  return { targetPercentage: decimal(enrolment.targetPercentage), targetLabel: enrolment.targetLabel, assessments: assessments.map(serializeAssessment) }
}

export async function createAssessment(userId, enrolmentId, input, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  return serializeAssessment(await database.assessment.create({ data: { userId, userModuleEnrolmentId: enrolmentId, ...assessmentData(input) }, include: assessmentInclude }))
}

export async function getAssessment(userId, assessmentId, database = prisma) {
  const record = await database.assessment.findFirst({ where: { id: assessmentId, userId }, include: { ...assessmentInclude, userModuleEnrolment: { include: { offering: { include: { module: true } } } } } })
  if (!record) throw domainError(404, 'Assessment not found.')
  return serializeAssessment(record)
}

export async function updateAssessment(userId, assessmentId, input, database = prisma) {
  const existing = await database.assessment.findFirst({ where: { id: assessmentId, userId } })
  if (!existing) throw domainError(404, 'Assessment not found.')
  const merged = { ...existing, ...input }
  if (merged.internalDeadline && merged.officialDeadline && new Date(merged.internalDeadline) > new Date(merged.officialDeadline)) throw domainError(400, 'Internal deadline must not be after the official deadline.')
  if (merged.eventDate && merged.eventEndDate && new Date(merged.eventEndDate) <= new Date(merged.eventDate)) throw domainError(400, 'Event end time must be after its start time.')
  if ((merged.score === null) !== (merged.maximumScore === null)) throw domainError(400, 'Score and maximum score must be provided together.')
  if (merged.score !== null && merged.maximumScore !== null && Number(merged.score) > Number(merged.maximumScore)) throw domainError(400, 'Score cannot exceed the maximum score.')
  return serializeAssessment(await database.assessment.update({ where: { id: assessmentId }, data: assessmentData(merged), include: assessmentInclude }))
}

export async function deleteAssessment(userId, assessmentId, database = prisma) {
  const result = await database.assessment.deleteMany({ where: { id: assessmentId, userId } })
  if (!result.count) throw domainError(404, 'Assessment not found.')
  return { deleted: true }
}

export async function updateGradeTarget(userId, enrolmentId, input, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  const result = await database.userModuleEnrolment.update({ where: { id: enrolmentId }, data: input, select: { targetPercentage: true, targetLabel: true } })
  return { targetPercentage: decimal(result.targetPercentage), targetLabel: result.targetLabel }
}

async function requireAssessment(database, userId, assessmentId) {
  const assessment = await database.assessment.findFirst({ where: { id: assessmentId, userId }, select: { id: true } })
  if (!assessment) throw domainError(404, 'Assessment not found.')
}

export async function createDeliverable(userId, assessmentId, input, database = prisma) { await requireAssessment(database, userId, assessmentId); return database.assessmentDeliverable.create({ data: { assessmentId, ...input } }) }
export async function updateDeliverable(userId, assessmentId, id, input, database = prisma) { await requireAssessment(database, userId, assessmentId); const result = await database.assessmentDeliverable.updateMany({ where: { id, assessmentId }, data: input }); if (!result.count) throw domainError(404, 'Deliverable not found.'); return database.assessmentDeliverable.findUnique({ where: { id } }) }
export async function deleteDeliverable(userId, assessmentId, id, database = prisma) { await requireAssessment(database, userId, assessmentId); const result = await database.assessmentDeliverable.deleteMany({ where: { id, assessmentId } }); if (!result.count) throw domainError(404, 'Deliverable not found.'); return { deleted: true } }
export async function createMilestone(userId, assessmentId, input, database = prisma) { await requireAssessment(database, userId, assessmentId); return database.assessmentMilestone.create({ data: { assessmentId, ...input } }) }
export async function updateMilestone(userId, assessmentId, id, input, database = prisma) { await requireAssessment(database, userId, assessmentId); const result = await database.assessmentMilestone.updateMany({ where: { id, assessmentId }, data: input }); if (!result.count) throw domainError(404, 'Milestone not found.'); return database.assessmentMilestone.findUnique({ where: { id } }) }
export async function deleteMilestone(userId, assessmentId, id, database = prisma) { await requireAssessment(database, userId, assessmentId); const result = await database.assessmentMilestone.deleteMany({ where: { id, assessmentId } }); if (!result.count) throw domainError(404, 'Milestone not found.'); return { deleted: true } }
