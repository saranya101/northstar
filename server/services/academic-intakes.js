import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { createAcademicInterpreter, moduleCodesInText } from '#shared/academic/intake-interpreter'
import { normalizeAssessmentName } from './academic'

const fail = (statusCode, statusMessage, data) => { throw createError({ statusCode, statusMessage, data }) }
const include = { moduleEnrolment: { select: { id: true, offering: { select: { module: { select: { code: true, title: true } } } } } }, proposals: { orderBy: { createdAt: 'asc' } } }
const date = value => value instanceof Date ? value.toISOString() : value
const serialize = intake => ({ ...intake, createdAt: date(intake.createdAt), updatedAt: date(intake.updatedAt), proposals: (intake.proposals || []).map(item => ({ ...item, appliedAt: date(item.appliedAt), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) })

async function moduleContext(database, userId, rawText, requestedId) {
  const enrolments = await database.userModuleEnrolment.findMany({ where: { userId, status: 'ACTIVE' }, select: { id: true, offering: { select: { module: { select: { code: true, title: true } } } } } })
  const requested = requestedId ? enrolments.find(item => item.id === requestedId) : null
  if (requestedId && !requested) fail(404, 'Module context not found.')
  const codes = moduleCodesInText(rawText)
  const matches = enrolments.filter(item => codes.includes(item.offering.module.code.toUpperCase()))
  if (matches.length > 1) return { moduleEnrolmentId: requestedId, clarificationReason: 'More than one active module is referenced. Choose the intended module.' }
  if (requested && matches[0] && matches[0].id !== requested.id) return { moduleEnrolmentId: requested.id, clarificationReason: `${matches[0].offering.module.code} conflicts with the selected ${requested.offering.module.code} context.` }
  if (codes.length && !matches.length) return { moduleEnrolmentId: requestedId, clarificationReason: `The referenced module ${codes.join(', ')} is not active in this semester.` }
  return { moduleEnrolmentId: requested?.id || matches[0]?.id, clarificationReason: null }
}

function duplicateAssessmentWhere(moduleEnrolmentId, payload) {
  return { userModuleEnrolmentId: moduleEnrolmentId, normalizedName: normalizeAssessmentName(payload.name), status: { not: 'CANCELLED' } }
}

async function proposalConflict(database, moduleEnrolmentId, proposal) {
  if (proposal.actionType === 'CREATE_ASSESSMENT' && moduleEnrolmentId) {
    const duplicate = await database.assessment.findFirst({ where: duplicateAssessmentWhere(moduleEnrolmentId, proposal.payload), select: { id: true, name: true } })
    if (duplicate) return { targetId: duplicate.id, reason: `An assessment named “${duplicate.name}” already exists for this module.` }
  }
  if (proposal.actionType === 'CREATE_COURSEWORK' && moduleEnrolmentId) {
    const duplicate = await database.recurringCoursework.findFirst({ where: { userModuleEnrolmentId: moduleEnrolmentId, title: { equals: proposal.payload.title, mode: 'insensitive' }, status: { not: 'ARCHIVED' } }, select: { id: true, title: true } })
    if (duplicate) return { targetId: duplicate.id, reason: `Coursework named “${duplicate.title}” already exists for this module.` }
  }
  return null
}

export async function createAcademicIntake(userId, input, database = prisma, interpreter = createAcademicInterpreter()) {
  const context = await moduleContext(database, userId, input.rawText, input.moduleEnrolmentId)
  let interpreted
  try { interpreted = await interpreter.interpret(input.rawText, { moduleEnrolmentId: context.moduleEnrolmentId }) }
  catch { interpreted = { category: 'GENERAL_NOTE', moduleEnrolmentId: context.moduleEnrolmentId, clarificationReason: 'We couldn’t confidently structure this text.', proposals: [] } }
  const clarificationReason = context.clarificationReason || interpreted.clarificationReason || ((!context.moduleEnrolmentId && interpreted.proposals.some(item => item.actionType !== 'ADD_NOTE')) ? 'Choose a module before applying this academic change.' : null)
  const proposals = []
  for (const proposal of interpreted.proposals) {
    const conflict = await proposalConflict(database, context.moduleEnrolmentId, proposal)
    proposals.push({ ...proposal, targetId: conflict?.targetId || proposal.targetId, status: conflict ? 'CONFLICT' : 'PENDING', conflictReason: conflict?.reason || null })
  }
  const record = await database.academicIntake.create({
    data: {
      userId, moduleEnrolmentId: context.moduleEnrolmentId, rawText: input.rawText, detectedCategory: interpreted.category,
      status: clarificationReason ? 'NEEDS_CLARIFICATION' : 'PENDING_REVIEW', clarificationReason, interpreterKey: interpreter.key,
      proposals: { create: proposals }
    }, include
  })
  return serialize(record)
}

export async function listAcademicIntakes(userId, database = prisma) {
  return (await database.academicIntake.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' }, take: 50 })).map(serialize)
}

export async function getAcademicIntake(userId, id, database = prisma) {
  const record = await database.academicIntake.findFirst({ where: { id, userId }, include })
  if (!record) fail(404, 'Academic intake not found.')
  return serialize(record)
}

async function applyProposal(tx, userId, intake, proposal) {
  const payload = proposal.payload
  if (proposal.actionType === 'ADD_NOTE') {
    if (intake.moduleEnrolmentId) await tx.userModuleFact.upsert({ where: { userModuleEnrolmentId_fieldName: { userModuleEnrolmentId: intake.moduleEnrolmentId, fieldName: `intake:${intake.id}` } }, create: { userModuleEnrolmentId: intake.moduleEnrolmentId, fieldName: `intake:${intake.id}`, value: intake.rawText }, update: { value: intake.rawText } })
    return null
  }
  if (!intake.moduleEnrolmentId) fail(409, 'Choose a module before applying this proposal.')
  if (proposal.actionType === 'CREATE_TASK') {
    const task = await tx.task.create({ data: { userId, moduleEnrolmentId: intake.moduleEnrolmentId, title: payload.title, description: intake.rawText, type: payload.type || 'STUDY', status: 'BACKLOG', priority: 'MEDIUM', timingNote: payload.timingNote || (payload.teachingWeek ? `Week ${payload.teachingWeek}` : null) } })
    return task.id
  }
  if (proposal.actionType === 'CREATE_ASSESSMENT') {
    const duplicate = await tx.assessment.findFirst({ where: duplicateAssessmentWhere(intake.moduleEnrolmentId, payload), select: { id: true } })
    if (duplicate) fail(409, 'A matching assessment already exists.')
    const assessment = await tx.assessment.create({ data: { userId, userModuleEnrolmentId: intake.moduleEnrolmentId, name: payload.name, normalizedName: normalizeAssessmentName(payload.name), type: payload.type, weight: payload.weight, officialDeadline: payload.officialDeadline, instructions: payload.instructions, status: 'NOT_STARTED' } })
    return assessment.id
  }
  if (proposal.actionType === 'CREATE_COURSEWORK') {
    if (!Number.isInteger(payload.totalExpected) || payload.totalExpected < 1) fail(409, 'Confirm the expected occurrence count before creating recurring coursework.')
    const duplicate = await tx.recurringCoursework.findFirst({ where: { userModuleEnrolmentId: intake.moduleEnrolmentId, title: { equals: payload.title, mode: 'insensitive' }, status: { not: 'ARCHIVED' } }, select: { id: true } })
    if (duplicate) fail(409, 'Matching recurring coursework already exists.')
    const coursework = await tx.recurringCoursework.create({ data: { userId, userModuleEnrolmentId: intake.moduleEnrolmentId, title: payload.title, type: payload.type || 'OTHER', description: intake.rawText, frequency: payload.frequency || 'CUSTOM', totalExpected: payload.totalExpected, firstTeachingWeek: payload.teachingWeek, lastTeachingWeek: payload.teachingWeek, timingNote: payload.timingNote } })
    return coursework.id
  }
  fail(409, 'This proposal type is not yet supported by the deterministic apply service.')
}

export async function approveAcademicProposal(userId, intakeId, proposalId, input, database = prisma) {
  return database.$transaction(async tx => {
    const intake = await tx.academicIntake.findFirst({ where: { id: intakeId, userId }, include: { proposals: true } })
    if (!intake) fail(404, 'Academic intake not found.')
    if (date(intake.updatedAt) !== input.expectedUpdatedAt) fail(409, 'This review changed. Reload before applying it.')
    const proposal = intake.proposals.find(item => item.id === proposalId)
    if (!proposal) fail(404, 'Academic proposal not found.')
    if (proposal.status === 'APPLIED') return { status: 'APPLIED', targetId: proposal.targetId, idempotent: true }
    if (proposal.status !== 'PENDING') fail(409, proposal.conflictReason || 'This proposal cannot be applied.')
    const targetId = await applyProposal(tx, userId, intake, proposal)
    const now = new Date()
    await tx.academicProposal.update({ where: { id: proposal.id }, data: { status: 'APPLIED', targetId, appliedAt: now } })
    const pending = await tx.academicProposal.count({ where: { intakeId, status: 'PENDING' } })
    if (!pending) await tx.academicIntake.update({ where: { id: intakeId }, data: { status: 'APPLIED' } })
    return { status: 'APPLIED', targetId, idempotent: false }
  }, { isolationLevel: 'Serializable' })
}

export async function dismissAcademicProposal(userId, intakeId, proposalId, input, database = prisma) {
  return database.$transaction(async tx => {
    const intake = await tx.academicIntake.findFirst({ where: { id: intakeId, userId }, include: { proposals: true } })
    if (!intake) fail(404, 'Academic intake not found.')
    if (date(intake.updatedAt) !== input.expectedUpdatedAt) fail(409, 'This review changed. Reload before dismissing it.')
    const proposal = intake.proposals.find(item => item.id === proposalId)
    if (!proposal) fail(404, 'Academic proposal not found.')
    if (proposal.status === 'DISMISSED') return { status: 'DISMISSED', idempotent: true }
    if (!['PENDING', 'CONFLICT'].includes(proposal.status)) fail(409, 'This proposal cannot be dismissed.')
    await tx.academicProposal.update({ where: { id: proposal.id }, data: { status: 'DISMISSED' } })
    const remaining = intake.proposals.filter(item => item.id !== proposal.id && item.status === 'PENDING').length
    if (!remaining) await tx.academicIntake.update({ where: { id: intakeId }, data: { status: 'DISMISSED' } })
    return { status: 'DISMISSED', idempotent: false }
  }, { isolationLevel: 'Serializable' })
}
