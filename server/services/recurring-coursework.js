import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { buildMissingOccurrences, recurringCourseworkProgress } from '#shared/academic/recurring-coursework'

const domainError = (statusCode, statusMessage) => createError({ statusCode, statusMessage })
const decimal = value => value === null || value === undefined ? null : Number(value)
const date = value => value instanceof Date ? value.toISOString() : value ?? null

async function transaction(database, operation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 }) }
    catch (error) {
      if (attempt === 0 && ['P2028', 'P2034'].includes(error?.code)) continue
      throw error
    }
  }
}

const requirementInclude = {
  assessment: { select: { id: true, name: true, weight: true, type: true } },
  occurrences: { orderBy: { sequenceNumber: 'asc' } }
}

async function requireEnrolment(database, userId, enrolmentId) {
  const enrolment = await database.userModuleEnrolment.findFirst({ where: { id: enrolmentId, userId }, select: { id: true } })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  return enrolment
}

async function requireRelatedRecords(database, userId, enrolmentId, { assessmentId } = {}) {
  if (assessmentId) {
    const assessment = await database.assessment.findFirst({ where: { id: assessmentId, userId, userModuleEnrolmentId: enrolmentId }, select: { id: true } })
    if (!assessment) throw domainError(400, 'The related assessment does not belong to this module.')
  }
}

function serializeOccurrence(value) {
  return {
    ...value,
    score: decimal(value.score), maximumScore: decimal(value.maximumScore),
    officialDueAt: date(value.officialDueAt), startedAt: date(value.startedAt), submittedAt: date(value.submittedAt), verifiedAt: date(value.verifiedAt),
    createdAt: date(value.createdAt), updatedAt: date(value.updatedAt),
    unverifiedSubmission: value.status === 'SUBMITTED'
  }
}

export function serializeRecurringCoursework(value) {
  const occurrences = (value.occurrences || []).map(serializeOccurrence)
  return {
    ...value,
    totalAssessmentWeight: decimal(value.totalAssessmentWeight),
    assessment: value.assessment ? { ...value.assessment, weight: decimal(value.assessment.weight) } : null,
    occurrences,
    progress: recurringCourseworkProgress(occurrences),
    createdAt: date(value.createdAt), updatedAt: date(value.updatedAt)
  }
}

function requirementData(input) {
  const allowed = ['assessmentId', 'title', 'type', 'description', 'frequency', 'totalExpected', 'firstTeachingWeek', 'lastTeachingWeek', 'recessWeeks', 'includeRecessWeeks', 'graded', 'totalAssessmentWeight', 'completeBeforeClass', 'timingNote', 'status']
  return Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key, input[key]]))
}

function validateMergedRequirement(value) {
  const hasFirst = value.firstTeachingWeek !== null && value.firstTeachingWeek !== undefined
  const hasLast = value.lastTeachingWeek !== null && value.lastTeachingWeek !== undefined
  if (hasFirst !== hasLast) throw domainError(400, 'Provide both the first and last teaching week.')
  if (hasFirst && value.firstTeachingWeek > value.lastTeachingWeek) throw domainError(400, 'Last teaching week must not be before the first.')
  if (!value.graded && value.totalAssessmentWeight !== null && value.totalAssessmentWeight !== undefined) throw domainError(400, 'Only graded coursework can have an assessment weight.')
}

function occurrenceCreates(requirement, existing = []) {
  return buildMissingOccurrences(requirement, existing).map(item => ({ ...item, userId: requirement.userId, recurringCourseworkId: requirement.id }))
}

export async function listRecurringCoursework(userId, enrolmentId, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  const records = await database.recurringCoursework.findMany({ where: { userId, userModuleEnrolmentId: enrolmentId }, include: requirementInclude, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })
  return records.map(serializeRecurringCoursework)
}

export async function getRecurringCoursework(userId, requirementId, database = prisma) {
  const record = await database.recurringCoursework.findFirst({ where: { id: requirementId, userId }, include: requirementInclude })
  if (!record) throw domainError(404, 'Recurring coursework not found.')
  return serializeRecurringCoursework(record)
}

export async function createRecurringCoursework(userId, enrolmentId, input, database = prisma) {
  return transaction(database, async tx => {
    await requireEnrolment(tx, userId, enrolmentId)
    await requireRelatedRecords(tx, userId, enrolmentId, input)
    validateMergedRequirement(input)
    const requirement = await tx.recurringCoursework.create({ data: { ...requirementData(input), userId, userModuleEnrolmentId: enrolmentId } })
    const occurrences = occurrenceCreates(requirement)
    if (occurrences.length) await tx.recurringCourseworkOccurrence.createMany({ data: occurrences, skipDuplicates: true })
    return serializeRecurringCoursework(await tx.recurringCoursework.findUnique({ where: { id: requirement.id }, include: requirementInclude }))
  })
}

export async function generateMissingOccurrences(userId, requirementId, expectedUpdatedAt, database = prisma) {
  return transaction(database, async tx => {
    const requirement = await tx.recurringCoursework.findFirst({ where: { id: requirementId, userId }, include: { occurrences: true } })
    if (!requirement) throw domainError(404, 'Recurring coursework not found.')
    if (requirement.status === 'ARCHIVED') throw domainError(409, 'Archived coursework cannot generate occurrences.')
    if (requirement.updatedAt.toISOString() !== expectedUpdatedAt) throw domainError(409, 'This coursework changed in another session. Reload before saving.')
    const occurrences = occurrenceCreates(requirement, requirement.occurrences)
    if (occurrences.length) await tx.recurringCourseworkOccurrence.createMany({ data: occurrences, skipDuplicates: true })
    return serializeRecurringCoursework(await tx.recurringCoursework.findUnique({ where: { id: requirementId }, include: requirementInclude }))
  })
}

export async function updateRecurringCoursework(userId, requirementId, input, database = prisma) {
  return transaction(database, async tx => {
    const current = await tx.recurringCoursework.findFirst({ where: { id: requirementId, userId }, include: { occurrences: true } })
    if (!current) throw domainError(404, 'Recurring coursework not found.')
    if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) throw domainError(409, 'This coursework changed in another session. Reload before saving.')
    const merged = { ...current, ...requirementData(input) }
    validateMergedRequirement(merged)
    if (input.assessmentId !== undefined) await requireRelatedRecords(tx, userId, current.userModuleEnrolmentId, { assessmentId: input.assessmentId })
    await tx.recurringCoursework.update({ where: { id: requirementId }, data: requirementData(input) })
    if (input.removeIncompleteOccurrences && input.totalExpected !== undefined) {
      await tx.recurringCourseworkOccurrence.deleteMany({ where: { recurringCourseworkId: requirementId, userId, sequenceNumber: { gt: input.totalExpected }, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } } })
    }
    const existing = await tx.recurringCourseworkOccurrence.findMany({ where: { recurringCourseworkId: requirementId } })
    const occurrences = occurrenceCreates(merged, existing)
    if (occurrences.length) await tx.recurringCourseworkOccurrence.createMany({ data: occurrences, skipDuplicates: true })
    return serializeRecurringCoursework(await tx.recurringCoursework.findUnique({ where: { id: requirementId }, include: requirementInclude }))
  })
}

export async function archiveRecurringCoursework(userId, requirementId, database = prisma) {
  const result = await database.recurringCoursework.updateMany({ where: { id: requirementId, userId, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } })
  if (!result.count) throw domainError(404, 'Recurring coursework not found.')
  return { status: 'ARCHIVED' }
}

async function requireOccurrence(database, userId, occurrenceId) {
  const occurrence = await database.recurringCourseworkOccurrence.findFirst({ where: { id: occurrenceId, userId } })
  if (!occurrence) throw domainError(404, 'Coursework occurrence not found.')
  return occurrence
}

function ensureCurrent(value, expectedUpdatedAt) {
  if (value.updatedAt.toISOString() !== expectedUpdatedAt) throw domainError(409, 'This occurrence changed in another session. Reload before saving.')
}

export async function updateRecurringOccurrence(userId, occurrenceId, input, database = prisma) {
  const occurrence = await requireOccurrence(database, userId, occurrenceId)
  ensureCurrent(occurrence, input.expectedUpdatedAt)
  const now = new Date()
  const data = Object.fromEntries(['status', 'officialDueAt', 'timingNote', 'privateNotes', 'score', 'maximumScore'].filter(key => input[key] !== undefined).map(key => [key, input[key]]))
  if (input.status === 'IN_PROGRESS' && !occurrence.startedAt) data.startedAt = now
  if (input.status === 'SUBMITTED') Object.assign(data, { workCompleted: true, submittedAt: occurrence.submittedAt || now })
  if (input.score !== undefined) data.markCaptured = input.score !== null
  return serializeOccurrence(await database.recurringCourseworkOccurrence.update({ where: { id: occurrenceId }, data }))
}

export async function updateSubmissionVerification(userId, occurrenceId, input, database = prisma) {
  const occurrence = await requireOccurrence(database, userId, occurrenceId)
  ensureCurrent(occurrence, input.expectedUpdatedAt)
  const data = Object.fromEntries(['workCompleted', 'finalConfirmationClicked', 'gradeCentreChecked', 'markCaptured', 'submissionReference', 'score', 'maximumScore'].filter(key => input[key] !== undefined).map(key => [key, input[key]]))
  const merged = { ...occurrence, ...data }
  const now = new Date()
  if (input.score !== undefined) data.markCaptured = input.score !== null
  if (merged.workCompleted && merged.finalConfirmationClicked && merged.gradeCentreChecked) Object.assign(data, { status: 'VERIFIED', submittedAt: occurrence.submittedAt || now, verifiedAt: now })
  else if (['SUBMITTED', 'VERIFIED'].includes(occurrence.status)) Object.assign(data, { status: 'SUBMITTED', verifiedAt: null })
  return serializeOccurrence(await database.recurringCourseworkOccurrence.update({ where: { id: occurrenceId }, data }))
}
