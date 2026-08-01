import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { parseCourseOutline } from '#shared/academic/course-outline-parser'
import { normalizeAssessmentName } from './academic'

const domainError = (statusCode, statusMessage, data) => createError({ statusCode, statusMessage, data })
const decimal = value => value === null || value === undefined ? null : Number(value)
const date = value => value instanceof Date ? value.toISOString() : value ?? null
const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
const missing = value => value === null || value === undefined || value === ''

async function transaction(database, operation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 }) }
    catch (error) {
      if (attempt === 0 && ['P2028', 'P2034'].includes(error?.code)) continue
      throw error
    }
  }
}

async function requireEnrolment(database, userId, enrolmentId) {
  const enrolment = await database.userModuleEnrolment.findFirst({
    where: { id: enrolmentId, userId },
    include: {
      offering: { include: { module: true, academicTerm: true } },
      assessments: { include: { provenance: true } },
      weeklyTopics: true,
      privateFacts: true
    }
  })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  return enrolment
}

function proposal({ targetType, targetId = null, fieldName, currentValue = null, proposedValue = null, classification, source, sourceOrder }) {
  return {
    targetType, targetId, fieldName,
    ...(currentValue === null || currentValue === undefined ? {} : { currentValue }),
    ...(proposedValue === null || proposedValue === undefined ? {} : { proposedValue }),
    classification,
    confidence: source?.confidence ?? null,
    pageNumber: source?.pageNumber ?? null,
    sourceExcerpt: source?.sourceExcerpt ?? null,
    sourceOrder
  }
}

export function classifyDocumentChange(currentValue, proposedValue, { conflict = false } = {}) {
  if (same(currentValue, proposedValue)) return 'NO_CHANGE'
  if (missing(currentValue) && !missing(proposedValue)) return 'FILL_MISSING'
  return conflict ? 'CONFLICT' : 'UPDATE'
}

function assessmentPayload(candidate) {
  return {
    name: candidate.name.value,
    type: candidate.type.value,
    weight: candidate.weight.value,
    officialDeadline: candidate.officialDeadline.value,
    eventDate: candidate.eventDate.value,
    submissionPlatform: candidate.submissionPlatform.value,
    submissionUrl: candidate.submissionUrl.value,
    instructions: candidate.instructions.value,
    examFormat: candidate.examFormat.value,
    groupAssessment: candidate.groupAssessment.value
  }
}

function assessmentSource(candidate, fieldName) {
  return candidate[fieldName] || candidate.name
}

function findAssessmentMatch(payload, assessments) {
  const normalizedName = normalizeAssessmentName(payload.name || '')
  const nameMatches = assessments.filter(item => item.normalizedName === normalizedName || normalizeAssessmentName(item.name) === normalizedName)
  if (nameMatches.length < 2) return nameMatches[0]
  const score = item => Number(item.type === payload.type) * 4
    + Number(!missing(payload.weight) && decimal(item.weight) === decimal(payload.weight)) * 2
    + Number(!missing(payload.groupAssessment) && item.groupAssessment === payload.groupAssessment)
  return nameMatches.toSorted((left, right) => score(right) - score(left))[0]
}

export function buildDocumentProposals(parsed, enrolment) {
  const proposals = []
  let sourceOrder = 0
  const assessments = enrolment.assessments || []
  const weeklyTopics = enrolment.weeklyTopics || []
  const privateFacts = new Map((enrolment.privateFacts || []).map(item => [item.fieldName, item.value]))
  const moduleValues = {
    moduleCode: enrolment.offering?.module?.code ?? null,
    moduleTitle: enrolment.offering?.module?.title ?? null,
    academicUnits: decimal(enrolment.offering?.module?.academicUnits),
    academicYear: enrolment.offering?.academicTerm?.academicYear ?? null,
    semesterLabel: enrolment.offering?.academicTerm?.name ?? null,
    lecturer: privateFacts.get('lecturer') ?? null
  }

  for (const fact of parsed.facts) {
    const currentValue = privateFacts.get(fact.fieldName) ?? moduleValues[fact.fieldName] ?? null
    proposals.push(proposal({
      targetType: 'MODULE_FACT', fieldName: fact.fieldName, currentValue, proposedValue: String(fact.value),
      classification: classifyDocumentChange(currentValue, String(fact.value), { conflict: !missing(currentValue) }),
      source: fact, sourceOrder: sourceOrder++
    }))
  }

  for (const candidate of parsed.assessments) {
    const payload = assessmentPayload(candidate)
    const existing = findAssessmentMatch(payload, assessments)
    if (!existing) {
      proposals.push(proposal({ targetType: 'ASSESSMENT', fieldName: 'assessment', proposedValue: payload, classification: 'ADD', source: candidate.name, sourceOrder: sourceOrder++ }))
      continue
    }
    const conflictFields = new Set(['name', 'type', 'weight', 'officialDeadline', 'eventDate', 'groupAssessment'])
    for (const [fieldName, proposedValue] of Object.entries(payload)) {
      if (missing(proposedValue)) continue
      const currentValue = fieldName === 'weight' ? decimal(existing[fieldName]) : date(existing[fieldName])
      proposals.push(proposal({
        targetType: 'ASSESSMENT', targetId: existing.id, fieldName, currentValue, proposedValue,
        classification: classifyDocumentChange(currentValue, proposedValue, { conflict: conflictFields.has(fieldName) }),
        source: assessmentSource(candidate, fieldName), sourceOrder: sourceOrder++
      }))
    }
  }

  for (const week of parsed.weeks) {
    const value = { weekNumber: week.weekNumber, topic: week.topic, reading: week.reading, activity: week.activity, importantDate: week.importantDate }
    const existing = weeklyTopics.find(item => item.weekNumber === week.weekNumber)
    const currentValue = existing ? { weekNumber: existing.weekNumber, topic: existing.topic, reading: existing.reading, activity: existing.activity, importantDate: existing.importantDate } : null
    const proposedValue = existing
      ? Object.fromEntries(Object.entries(value).map(([fieldName, fieldValue]) => [fieldName, missing(fieldValue) ? currentValue[fieldName] : fieldValue]))
      : value
    proposals.push(proposal({
      targetType: 'WEEKLY_TOPIC', targetId: existing?.id, fieldName: 'week', currentValue, proposedValue,
      classification: existing ? classifyDocumentChange(currentValue, proposedValue) : 'ADD', source: week, sourceOrder: sourceOrder++
    }))
  }
  return proposals
}

function candidateCreate(candidate) {
  const fields = ['name', 'type', 'weight', 'officialDeadline', 'eventDate', 'submissionPlatform', 'submissionUrl', 'instructions', 'groupAssessment', 'examFormat', 'durationMinutes', 'openBook']
  return {
    sourceOrder: candidate.sourceOrder,
    name: candidate.name.value, type: candidate.type.value, weight: candidate.weight.value,
    officialDeadline: candidate.officialDeadline.value, eventDate: candidate.eventDate.value,
    submissionPlatform: candidate.submissionPlatform.value, submissionUrl: candidate.submissionUrl.value,
    instructions: candidate.instructions.value, groupAssessment: candidate.groupAssessment.value,
    examFormat: candidate.examFormat.value, durationMinutes: candidate.durationMinutes.value,
    openBook: candidate.openBook.value, deliverables: candidate.deliverables, rubricHeadings: candidate.rubricHeadings, warnings: candidate.warnings,
    provenance: { create: fields.filter(fieldName => candidate[fieldName]?.value !== null).map(fieldName => ({
      fieldName, pageNumber: candidate[fieldName].pageNumber, sectionHeading: candidate[fieldName].sectionHeading,
      sourceExcerpt: candidate[fieldName].sourceExcerpt, confidence: candidate[fieldName].confidence
    })) }
  }
}

const documentInclude = {
  proposals: { orderBy: { sourceOrder: 'asc' } },
  _count: { select: { proposals: true } },
  userModuleEnrolment: { include: { offering: { include: { module: true } } } }
}

export function serializeCourseDocument(value) {
  return {
    id: value.id, userModuleEnrolmentId: value.userModuleEnrolmentId,
    documentType: value.documentType, displayTitle: value.displayTitle || value.sourceLabel,
    originalFileName: value.originalFileName, mimeType: value.mimeType, fileSize: value.fileSize,
    sha256Hash: value.sha256Hash, sourceDate: date(value.sourceDate), status: value.status,
    parserVersion: value.parserVersion, safeErrorMessage: value.safeErrorMessage,
    storageProvider: value.storageProvider, originalRetained: Boolean(value.storageProvider && value.storageKey),
    duplicateCount: value.duplicateCount || 0, duplicateLastSeenAt: date(value.duplicateLastSeenAt),
    proposalCount: value._count?.proposals ?? value.proposals?.length ?? 0,
    pendingProposalCount: value.proposals?.filter(item => item.status === 'PENDING').length,
    proposals: value.proposals?.map(item => ({ ...item, confidence: decimal(item.confidence), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })),
    module: value.userModuleEnrolment?.offering?.module,
    confirmedAt: date(value.confirmedAt), createdAt: date(value.createdAt), updatedAt: date(value.updatedAt)
  }
}

async function markDuplicate(database, document) {
  const updated = await database.courseOutlineImport.update({
    where: { id: document.id },
    data: { duplicateCount: { increment: 1 }, duplicateLastSeenAt: new Date() },
    include: documentInclude
  })
  return { ...serializeCourseDocument(updated), duplicate: true }
}

export async function createCourseDocument(userId, enrolmentId, input, database = prisma) {
  const enrolment = await requireEnrolment(database, userId, enrolmentId)
  const sha256Hash = input.sha256Hash.toLowerCase()
  const duplicate = await database.courseOutlineImport.findFirst({ where: { userId, userModuleEnrolmentId: enrolmentId, sha256Hash }, include: documentInclude })
  if (duplicate) return markDuplicate(database, duplicate)
  const parsed = parseCourseOutline(input.extractedText, { activeAcademicYear: enrolment.offering.academicTerm.academicYear, activeSemester: enrolment.offering.academicTerm.name })
  const proposals = buildDocumentProposals(parsed, enrolment)
  let record
  try {
    record = await database.courseOutlineImport.create({
      data: {
        userId, userModuleEnrolmentId: enrolmentId, documentType: input.documentType,
        displayTitle: input.displayTitle, originalFileName: input.originalFileName, mimeType: input.mimeType,
        fileSize: input.fileSize, sha256Hash, sourceDate: input.sourceDate,
        sourceType: input.sourceType, sourceLabel: input.displayTitle, rawExtractedText: input.extractedText,
        parserVersion: parsed.parserVersion, extractionConfidence: input.extractionConfidence,
        academicYear: parsed.academicYear, semesterLabel: parsed.semesterLabel, historical: parsed.historical,
        warnings: parsed.warnings,
        candidates: { create: parsed.assessments.map(candidateCreate) },
        facts: { create: parsed.facts.map(({ fieldName, value, sourceOrder, pageNumber, sectionHeading, sourceExcerpt, confidence }) => ({ fieldName, value: String(value), sourceOrder, pageNumber, sectionHeading, sourceExcerpt, confidence })) },
        weeks: { create: parsed.weeks }, proposals: { create: proposals }
      },
      include: documentInclude
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    const concurrentDuplicate = await database.courseOutlineImport.findFirst({ where: { userId, userModuleEnrolmentId: enrolmentId, sha256Hash }, include: documentInclude })
    if (!concurrentDuplicate) throw error
    return markDuplicate(database, concurrentDuplicate)
  }
  return serializeCourseDocument(record)
}

export async function listCourseDocuments(userId, enrolmentId, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  const records = await database.courseOutlineImport.findMany({ where: { userId, userModuleEnrolmentId: enrolmentId }, include: { _count: { select: { proposals: true } } }, orderBy: { createdAt: 'desc' } })
  return records.map(serializeCourseDocument)
}

export async function getCourseDocument(userId, documentId, database = prisma) {
  const record = await database.courseOutlineImport.findFirst({ where: { id: documentId, userId }, include: documentInclude })
  if (!record) throw domainError(404, 'Course document not found.')
  return serializeCourseDocument(record)
}

const assessmentFields = new Set(['name', 'type', 'weight', 'officialDeadline', 'eventDate', 'submissionPlatform', 'submissionUrl', 'instructions', 'examFormat', 'groupAssessment'])

function assessmentCreateData(value, userId, enrolmentId, importId) {
  return {
    userId, userModuleEnrolmentId: enrolmentId, sourceImportId: importId,
    name: value.name, normalizedName: normalizeAssessmentName(value.name), type: value.type,
    weight: value.weight, officialDeadline: value.officialDeadline, eventDate: value.eventDate,
    submissionPlatform: value.submissionPlatform, submissionUrl: value.submissionUrl,
    instructions: value.instructions, examFormat: value.examFormat, groupAssessment: value.groupAssessment
  }
}

async function recordEvidence(tx, { userId, document, proposal, targetId, confirmedAt }) {
  await tx.courseDocumentEvidence.upsert({
    where: { importId_targetType_targetId_fieldName: { importId: document.id, targetType: proposal.targetType, targetId, fieldName: proposal.fieldName } },
    create: { userId, importId: document.id, targetType: proposal.targetType, targetId, fieldName: proposal.fieldName, pageNumber: proposal.pageNumber, sourceExcerpt: proposal.sourceExcerpt, confidence: proposal.confidence, confirmedAt },
    update: { pageNumber: proposal.pageNumber, sourceExcerpt: proposal.sourceExcerpt, confidence: proposal.confidence, confirmedAt }
  })
  if (proposal.targetType === 'ASSESSMENT') {
    await tx.assessmentProvenance.upsert({
      where: { assessmentId_sourceImportId_fieldName: { assessmentId: targetId, sourceImportId: document.id, fieldName: proposal.fieldName } },
      create: { assessmentId: targetId, sourceImportId: document.id, fieldName: proposal.fieldName, originalFileName: document.originalFileName, sourceLabel: document.displayTitle || document.sourceLabel, sourceType: document.sourceType, pageNumber: proposal.pageNumber, sourceExcerpt: proposal.sourceExcerpt, confidence: proposal.confidence, confirmedAt },
      update: { pageNumber: proposal.pageNumber, sourceExcerpt: proposal.sourceExcerpt, confidence: proposal.confidence, confirmedAt }
    })
  }
}

async function applyProposal(tx, userId, document, proposal, proposedValue, confirmedAt) {
  let targetId = proposal.targetId
  if (proposal.targetType === 'ASSESSMENT') {
    if (proposal.fieldName === 'assessment') {
      const value = proposedValue
      const existing = await tx.assessment.findFirst({ where: { userId, userModuleEnrolmentId: document.userModuleEnrolmentId, normalizedName: normalizeAssessmentName(value.name) } })
      targetId = existing?.id || (await tx.assessment.create({ data: assessmentCreateData(value, userId, document.userModuleEnrolmentId, document.id) })).id
    } else {
      if (!assessmentFields.has(proposal.fieldName) || !targetId) throw domainError(400, 'Unsupported assessment proposal.')
      const result = await tx.assessment.updateMany({ where: { id: targetId, userId, userModuleEnrolmentId: document.userModuleEnrolmentId }, data: { [proposal.fieldName]: proposedValue, ...(proposal.fieldName === 'name' ? { normalizedName: normalizeAssessmentName(proposedValue) } : {}) } })
      if (!result.count) throw domainError(404, 'Assessment target not found.')
    }
  } else if (proposal.targetType === 'WEEKLY_TOPIC') {
    const value = proposedValue
    const weekly = await tx.moduleWeeklyTopic.upsert({ where: { userModuleEnrolmentId_weekNumber: { userModuleEnrolmentId: document.userModuleEnrolmentId, weekNumber: value.weekNumber } }, create: { userModuleEnrolmentId: document.userModuleEnrolmentId, ...value }, update: value })
    targetId = weekly.id
  } else if (proposal.targetType === 'MODULE_FACT') {
    const fact = await tx.userModuleFact.upsert({ where: { userModuleEnrolmentId_fieldName: { userModuleEnrolmentId: document.userModuleEnrolmentId, fieldName: proposal.fieldName } }, create: { userModuleEnrolmentId: document.userModuleEnrolmentId, fieldName: proposal.fieldName, value: String(proposedValue) }, update: { value: String(proposedValue) } })
    targetId = fact.id
  }
  await recordEvidence(tx, { userId, document, proposal, targetId, confirmedAt })
}

export async function reviewCourseDocument(userId, documentId, input, database = prisma) {
  return transaction(database, async tx => {
    const document = await tx.courseOutlineImport.findFirst({ where: { id: documentId, userId }, include: { proposals: true } })
    if (!document) throw domainError(404, 'Course document not found.')
    if (document.status === 'CONFIRMED') return { status: 'CONFIRMED', idempotent: true, appliedCount: 0 }
    if (document.status !== 'REVIEW_REQUIRED') throw domainError(409, 'This document cannot be reviewed.')
    if (document.updatedAt.toISOString() !== input.expectedUpdatedAt) throw domainError(409, 'This review changed in another session. Reload before saving.')
    const byId = new Map(document.proposals.map(item => [item.id, item]))
    const confirmedAt = new Date()
    let appliedCount = 0
    for (const decision of input.decisions) {
      const proposal = byId.get(decision.id)
      if (!proposal) throw domainError(404, 'Document proposal not found.')
      if (proposal.status !== 'PENDING') continue
      if (decision.action === 'REJECT') {
        await tx.courseDocumentProposal.update({ where: { id: proposal.id }, data: { status: 'REJECTED' } })
        continue
      }
      const proposedValue = decision.proposedValue === undefined ? proposal.proposedValue : decision.proposedValue
      await applyProposal(tx, userId, document, proposal, proposedValue, confirmedAt)
      await tx.courseDocumentProposal.update({ where: { id: proposal.id }, data: { status: 'APPROVED', proposedValue } })
      appliedCount += 1
    }
    const pendingCount = await tx.courseDocumentProposal.count({ where: { importId: document.id, status: 'PENDING' } })
    const status = pendingCount ? 'REVIEW_REQUIRED' : 'CONFIRMED'
    await tx.courseOutlineImport.update({ where: { id: document.id }, data: { status, ...(status === 'CONFIRMED' ? { confirmedAt } : {}) } })
    return { status, idempotent: false, appliedCount, pendingCount }
  })
}

export async function archiveCourseDocument(userId, documentId, database = prisma) {
  const result = await database.courseOutlineImport.updateMany({ where: { id: documentId, userId, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } })
  if (!result.count) throw domainError(404, 'Course document not found.')
  return { status: 'ARCHIVED' }
}
