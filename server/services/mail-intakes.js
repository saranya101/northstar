import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { createOpportunitySchema } from '#shared/schemas/opportunities'
import { createTaskSchema } from '#shared/schemas/tasks'
import { createMailInterpreter } from './mail-intelligence'
import { splitPastedEmails } from './mail-segmentation'
import { createOpportunity, findOpportunityDuplicates } from './opportunities'
import { createTask } from './tasks'

const include = {
  convertedOpportunity: { select: { id: true, title: true, organisation: true } },
  convertedTask: { select: { id: true, title: true } }
}
const fail = (statusCode, statusMessage, fieldErrors = {}) => { throw createError({ statusCode, statusMessage, data: { fieldErrors } }) }
const iso = value => value instanceof Date ? value.toISOString() : value ?? null
const defined = object => Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined))
const opportunityFields = ['title', 'organisation', 'category', 'description', 'sourceUrl', 'applicationUrl', 'deadline', 'startAt', 'endAt', 'location', 'mode', 'commitment', 'eligibilityText', 'requirements', 'benefits', 'tags']
const canonicalOpportunity = object => Object.fromEntries(opportunityFields.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]))

export function mailContentFingerprint(input) {
  const normalized = {
    subject: input.subject?.trim() || null,
    senderEmail: input.senderEmail?.trim().toLowerCase() || null,
    rawText: input.rawText.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim()
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export function serializeMailIntake(record, duplicate = false) {
  return {
    ...record,
    receivedAt: iso(record.receivedAt), createdAt: iso(record.createdAt), updatedAt: iso(record.updatedAt),
    duplicate
  }
}

async function interpretedMail(input, interpreter) {
  let interpreted
  try { interpreted = await interpreter.interpret(input) }
  catch {
    interpreted = {
      metadata: { subject: input.subject || null, senderName: input.senderName || null, senderEmail: input.senderEmail || null, receivedAt: input.receivedAt || null },
      classification: { category: 'UNCERTAIN', confidenceBand: 'LOW', reasons: ['The message could not be structured safely'] },
      extractedPayload: { opportunity: null, admin: null, unresolved: ['Interpretation failed safely; review the retained source text.'] }
    }
  }
  return interpreted
}

async function persistMailIntake(userId, input, database, interpreter) {
  const interpreted = await interpretedMail(input, interpreter)
  const merged = { ...input, ...interpreted.metadata }
  const contentFingerprint = mailContentFingerprint(merged)
  const existing = await database.mailIntake.findUnique({
    where: { userId_contentFingerprint: { userId, contentFingerprint } }, include
  })
  if (existing) return serializeMailIntake(existing, true)
  try {
    const record = await database.mailIntake.create({ data: {
      userId, subject: merged.subject, senderName: merged.senderName, senderEmail: merged.senderEmail,
      receivedAt: merged.receivedAt ? new Date(merged.receivedAt) : null, rawText: input.rawText, contentFingerprint,
      classification: interpreted.classification.category, confidenceBand: interpreted.classification.confidenceBand,
      reasons: interpreted.classification.reasons, extractedPayload: interpreted.extractedPayload,
      interpreterKey: interpreter.key
    }, include })
    return serializeMailIntake(record)
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    const duplicate = await database.mailIntake.findUnique({ where: { userId_contentFingerprint: { userId, contentFingerprint } }, include })
    return serializeMailIntake(duplicate, true)
  }
}

export async function previewMailPaste(input, interpreter = createMailInterpreter()) {
  const proposal = splitPastedEmails(input.rawText)
  const segments = await Promise.all(proposal.segments.map(async (segment, index) => {
    const segmentInput = proposal.segments.length === 1 ? { ...input, rawText: segment.rawText } : { rawText: segment.rawText }
    const interpreted = await interpretedMail(segmentInput, interpreter)
    const merged = { ...segmentInput, ...interpreted.metadata }
    return {
      id: `segment-${index + 1}`,
      ...segment,
      ...interpreted.metadata,
      classification: interpreted.classification,
      extractedPayload: interpreted.extractedPayload,
      contentFingerprint: mailContentFingerprint(merged)
    }
  }))
  return {
    segments,
    ambiguous: proposal.ambiguous,
    warning: proposal.warning,
    requiresBoundaryReview: segments.length > 1 || proposal.ambiguous
  }
}

export async function createMailIntake(userId, input, database = prisma, interpreter = createMailInterpreter()) {
  const proposal = splitPastedEmails(input.rawText)
  if (proposal.segments.length > 1 || proposal.ambiguous) {
    fail(409, 'Multiple emails may be present. Review the proposed splits before continuing.')
  }
  return persistMailIntake(userId, input, database, interpreter)
}

export async function createMailBatch(userId, messages, database = prisma, interpreter = createMailInterpreter()) {
  const records = []
  for (const input of messages) records.push(await persistMailIntake(userId, input, database, interpreter))
  return records
}

export async function listMailIntakes(userId, database = prisma) {
  const rows = await database.mailIntake.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' }, take: 50 })
  return rows.map(row => serializeMailIntake(row))
}

export async function getMailIntake(userId, id, database = prisma) {
  const record = await database.mailIntake.findFirst({ where: { id, userId }, include })
  if (!record) fail(404, 'Mail intake not found.')
  return record
}

function assertCurrent(record, expectedUpdatedAt) {
  if (iso(record.updatedAt) !== expectedUpdatedAt) fail(409, 'This mail review changed. Reload before continuing.')
}

async function updateOwned(database, userId, id, data) {
  const result = await database.mailIntake.updateMany({ where: { id, userId }, data })
  if (!result.count) fail(404, 'Mail intake not found.')
  return serializeMailIntake(await database.mailIntake.findFirst({ where: { id, userId }, include }))
}

export async function dismissMailIntake(userId, id, input, database = prisma) {
  const record = await getMailIntake(userId, id, database)
  assertCurrent(record, input.expectedUpdatedAt)
  if (record.status === 'CONVERTED') fail(409, 'Converted mail cannot be dismissed.')
  if (record.status === 'DISMISSED') return serializeMailIntake(record)
  return updateOwned(database, userId, id, { status: 'DISMISSED' })
}

export async function retainMailAsNote(userId, id, input, database = prisma) {
  const record = await getMailIntake(userId, id, database)
  assertCurrent(record, input.expectedUpdatedAt)
  if (record.status === 'CONVERTED') return serializeMailIntake(record)
  if (record.status === 'DISMISSED') fail(409, 'Dismissed mail cannot be saved as a note.')
  return updateOwned(database, userId, id, { status: 'REVIEWED' })
}

function validatedOpportunity(record, overrides) {
  const extracted = record.extractedPayload?.opportunity
  if (!extracted) fail(409, 'This mail does not contain an opportunity proposal.')
  const result = createOpportunitySchema.safeParse({
    ...canonicalOpportunity(extracted), ...canonicalOpportunity(defined(overrides)), sourceType: 'EMAIL', sourceName: 'NTU Mail', allowDuplicate: false
  })
  if (!result.success) fail(400, 'Review the unresolved opportunity fields.', Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.') || '_form', issue.message])))
  return result.data
}

export async function convertMailToOpportunity(userId, id, input, database = prisma) {
  const record = await getMailIntake(userId, id, database)
  assertCurrent(record, input.expectedUpdatedAt)
  if (record.convertedOpportunityId) return { intake: serializeMailIntake(record), opportunityId: record.convertedOpportunityId, duplicate: true }
  if (!['OPPORTUNITY', 'EVENT'].includes(record.classification)) fail(409, 'This mail is not an opportunity or event proposal.')
  if (record.status === 'DISMISSED') fail(409, 'Dismissed mail cannot be converted.')
  const opportunityInput = validatedOpportunity(record, input.opportunity)
  const duplicates = await findOpportunityDuplicates(userId, opportunityInput, database)
  let opportunityId = duplicates[0]?.id || null
  if (!opportunityId) opportunityId = (await createOpportunity(userId, opportunityInput, database)).id
  const intake = await updateOwned(database, userId, id, {
    status: 'CONVERTED', convertedOpportunityId: opportunityId,
    extractedPayload: { ...record.extractedPayload, opportunity: { ...record.extractedPayload.opportunity, ...defined(input.opportunity) } }
  })
  return { intake, opportunityId, duplicate: Boolean(duplicates.length) }
}

async function activeModuleId(database, userId, moduleCode) {
  if (!moduleCode) return null
  const enrolment = await database.userModuleEnrolment.findFirst({
    where: { userId, status: 'ACTIVE', offering: { module: { code: { equals: moduleCode, mode: 'insensitive' } } } }, select: { id: true }
  })
  return enrolment?.id || null
}

export async function convertMailToTask(userId, id, input, database = prisma) {
  const record = await getMailIntake(userId, id, database)
  assertCurrent(record, input.expectedUpdatedAt)
  if (record.convertedTaskId) return { intake: serializeMailIntake(record), taskId: record.convertedTaskId, duplicate: true }
  if (!['ACTION_REQUIRED', 'ACADEMIC_ADMIN'].includes(record.classification)) fail(409, 'This mail is not an academic or administrative action proposal.')
  if (record.status === 'DISMISSED') fail(409, 'Dismissed mail cannot be converted.')
  const admin = record.extractedPayload?.admin || {}
  const parsed = createTaskSchema.safeParse({
    moduleEnrolmentId: await activeModuleId(database, userId, admin.moduleCode),
    title: input.title || admin.title, description: record.rawText, type: 'ADMIN', status: 'BACKLOG', priority: 'MEDIUM',
    dueAt: input.dueAt || admin.deadline || undefined, timingNote: admin.deadline ? undefined : admin.deadlineSourceText || undefined
  })
  if (!parsed.success) fail(400, 'Review the unresolved task fields.', Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.') || '_form', issue.message])))
  const task = await createTask(userId, parsed.data, database)
  const intake = await updateOwned(database, userId, id, { status: 'CONVERTED', convertedTaskId: task.id })
  return { intake, taskId: task.id, duplicate: false }
}
