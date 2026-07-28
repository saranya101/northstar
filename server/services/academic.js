import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { parseCourseOutline } from '~~/shared/academic/course-outline-parser'

const domainError = (statusCode, statusMessage, data) => createError({ statusCode, statusMessage, data })
const decimal = value => value === null || value === undefined ? null : Number(value)
const date = value => value instanceof Date ? value.toISOString() : value ?? null
export const normalizeAssessmentName = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

async function transaction(database, operation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 })
    } catch (error) {
      if (attempt === 0 && ['P2028', 'P2034'].includes(error?.code)) continue
      throw error
    }
  }
}

async function requireEnrolment(database, userId, enrolmentId) {
  const enrolment = await database.userModuleEnrolment.findFirst({
    where: { id: enrolmentId, userId },
    include: { offering: { include: { module: true, academicTerm: true, instructorAssignments: { include: { instructor: true } } } } }
  })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  return enrolment
}

function assessmentData(input) {
  const score = decimal(input.score)
  const maximumScore = decimal(input.maximumScore)
  const weight = decimal(input.weight)
  const percentageScore = score !== null && maximumScore ? score / maximumScore * 100 : null
  const allowed = ['name', 'type', 'weight', 'officialDeadline', 'internalDeadline', 'eventDate', 'submissionPlatform', 'submissionUrl', 'instructions', 'examFormat', 'estimatedEffortMinutes', 'actualEffortMinutes', 'groupAssessment', 'status', 'score', 'maximumScore', 'feedback', 'reflection', 'submittedAt', 'gradedAt']
  return {
    ...Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key, input[key]])),
    normalizedName: normalizeAssessmentName(input.name),
    percentageScore,
    weightedScore: percentageScore !== null && weight !== null ? percentageScore * weight / 100 : null,
    status: input.status || (percentageScore !== null ? 'GRADED' : 'NOT_STARTED')
  }
}

function serializeProvenance(value) {
  return { ...value, confidence: decimal(value.confidence), confirmedAt: date(value.confirmedAt), createdAt: date(value.createdAt) }
}

export function serializeAssessment(value) {
  return {
    ...value,
    weight: decimal(value.weight),
    score: decimal(value.score),
    maximumScore: decimal(value.maximumScore),
    percentageScore: decimal(value.percentageScore),
    weightedScore: decimal(value.weightedScore),
    officialDeadline: date(value.officialDeadline),
    internalDeadline: date(value.internalDeadline),
    eventDate: date(value.eventDate),
    submittedAt: date(value.submittedAt),
    gradedAt: date(value.gradedAt),
    createdAt: date(value.createdAt),
    updatedAt: date(value.updatedAt),
    provenance: value.provenance?.map(serializeProvenance) || [],
    milestones: value.milestones?.map(item => ({ ...item, dueDate: date(item.dueDate), createdAt: date(item.createdAt), updatedAt: date(item.updatedAt) })) || [],
    deliverables: value.deliverables || []
  }
}

const assessmentInclude = {
  provenance: { orderBy: { fieldName: 'asc' } },
  deliverables: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
}

function candidateCreate(candidate) {
  const fields = ['name', 'type', 'weight', 'officialDeadline', 'eventDate', 'submissionPlatform', 'submissionUrl', 'instructions', 'groupAssessment', 'examFormat', 'durationMinutes', 'openBook']
  const data = {
    sourceOrder: candidate.sourceOrder,
    name: candidate.name.value,
    type: candidate.type.value,
    weight: candidate.weight.value,
    officialDeadline: candidate.officialDeadline.value,
    eventDate: candidate.eventDate.value,
    submissionPlatform: candidate.submissionPlatform.value,
    submissionUrl: candidate.submissionUrl.value,
    instructions: candidate.instructions.value,
    groupAssessment: candidate.groupAssessment.value,
    examFormat: candidate.examFormat.value,
    durationMinutes: candidate.durationMinutes.value,
    openBook: candidate.openBook.value,
    deliverables: candidate.deliverables,
    rubricHeadings: candidate.rubricHeadings,
    warnings: candidate.warnings,
    provenance: {
      create: fields.filter(fieldName => candidate[fieldName]?.value !== null).map(fieldName => ({
        fieldName,
        pageNumber: candidate[fieldName].pageNumber,
        sectionHeading: candidate[fieldName].sectionHeading,
        sourceExcerpt: candidate[fieldName].sourceExcerpt,
        confidence: candidate[fieldName].confidence
      }))
    }
  }
  return data
}

export async function createCourseOutlineImport(userId, enrolmentId, input, database = prisma) {
  const enrolment = await requireEnrolment(database, userId, enrolmentId)
  const parsed = parseCourseOutline(input.extractedText, {
    activeAcademicYear: enrolment.offering.academicTerm.academicYear,
    activeSemester: enrolment.offering.academicTerm.name
  })
  const existingAssessmentCount = await database.assessment.count({ where: { userId, userModuleEnrolmentId: enrolmentId } })
  if (existingAssessmentCount && parsed.assessments.length) parsed.warnings.push('This outline contains an assessment structure that must be reviewed against existing confirmed assessments.')
  const extractedLecturer = parsed.facts.find(item => item.fieldName === 'lecturer')?.value
  const currentInstructorNames = enrolment.offering.instructorAssignments.map(item => item.instructor.fullName.toLowerCase())
  if (extractedLecturer && currentInstructorNames.length && !currentInstructorNames.includes(extractedLecturer.toLowerCase())) {
    parsed.warnings.push('The extracted lecturer differs from the current teaching team.')
  }
  if (parsed.assessments.some(item => item.officialDeadline.value && new Date(item.officialDeadline.value) < new Date())) {
    parsed.warnings.push('One or more extracted deadlines have already passed.')
  }
  const duplicate = await database.courseOutlineImport.findFirst({
    where: { userId, userModuleEnrolmentId: enrolmentId, rawExtractedText: input.extractedText, status: { not: 'FAILED' } },
    select: { id: true, status: true }
  })
  if (duplicate) throw domainError(409, 'This course outline appears to have been imported already.', { importId: duplicate.id })

  const record = await database.courseOutlineImport.create({
    data: {
      userId,
      userModuleEnrolmentId: enrolmentId,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      rawExtractedText: input.extractedText,
      parserVersion: parsed.parserVersion,
      extractionConfidence: input.extractionConfidence,
      academicYear: parsed.academicYear,
      semesterLabel: parsed.semesterLabel,
      historical: parsed.historical,
      warnings: parsed.warnings,
      candidates: { create: parsed.assessments.map(candidateCreate) },
      facts: { create: parsed.facts.map(({ fieldName, value, sourceOrder, pageNumber, sectionHeading, sourceExcerpt, confidence }) => ({ fieldName, value: String(value), sourceOrder, pageNumber, sectionHeading, sourceExcerpt, confidence })) },
      weeks: { create: parsed.weeks }
    },
    include: importInclude
  })
  return serializeImport(record)
}

const importInclude = {
  candidates: { include: { provenance: true }, orderBy: { sourceOrder: 'asc' } },
  facts: { orderBy: { sourceOrder: 'asc' } },
  weeks: { orderBy: { sourceOrder: 'asc' } },
  userModuleEnrolment: { include: { offering: { include: { module: true, academicTerm: true } } } },
  _count: { select: { assessments: true } }
}

function serializeImport(value, includeRaw = false) {
  return {
    id: value.id,
    userModuleEnrolmentId: value.userModuleEnrolmentId,
    originalFileName: value.originalFileName,
    mimeType: value.mimeType,
    sourceType: value.sourceType,
    sourceLabel: value.sourceLabel,
    status: value.status,
    parserVersion: value.parserVersion,
    extractionConfidence: decimal(value.extractionConfidence),
    safeErrorMessage: value.safeErrorMessage,
    academicYear: value.academicYear,
    semesterLabel: value.semesterLabel,
    historical: value.historical,
    userConfirmedCurrent: value.userConfirmedCurrent,
    warnings: value.warnings,
    confirmedAt: date(value.confirmedAt),
    createdAt: date(value.createdAt),
    updatedAt: date(value.updatedAt),
    extractedText: includeRaw ? value.rawExtractedText : undefined,
    module: value.userModuleEnrolment ? {
      code: value.userModuleEnrolment.offering.module.code,
      title: value.userModuleEnrolment.offering.module.title,
      academicYear: value.userModuleEnrolment.offering.academicTerm.academicYear,
      semester: value.userModuleEnrolment.offering.academicTerm.name
    } : undefined,
    candidates: value.candidates?.map(item => ({ ...item, weight: decimal(item.weight), officialDeadline: date(item.officialDeadline), eventDate: date(item.eventDate), provenance: item.provenance.map(provenance => ({ ...provenance, confidence: decimal(provenance.confidence) })) })),
    facts: value.facts?.map(item => ({ ...item, confidence: decimal(item.confidence) })),
    weeks: value.weeks?.map(item => ({ ...item, confidence: decimal(item.confidence) })),
    confirmedAssessmentCount: value._count?.assessments || 0
  }
}

export async function listCourseOutlineImports(userId, enrolmentId, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  const records = await database.courseOutlineImport.findMany({
    where: { userId, userModuleEnrolmentId: enrolmentId },
    include: { _count: { select: { candidates: true, assessments: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return records.map(record => ({ ...serializeImport(record), extractedAssessmentCount: record._count.candidates }))
}

export async function getCourseOutlineImport(userId, importId, database = prisma) {
  const record = await database.courseOutlineImport.findFirst({ where: { id: importId, userId }, include: importInclude })
  if (!record) throw domainError(404, 'Course outline import not found.')
  return serializeImport(record)
}

export async function updateCourseOutlineImport(userId, importId, input, database = prisma) {
  return transaction(database, async tx => {
    const record = await tx.courseOutlineImport.findFirst({ where: { id: importId, userId } })
    if (!record) throw domainError(404, 'Course outline import not found.')
    if (record.status !== 'REVIEW_REQUIRED') throw domainError(409, 'Only an unfinished review can be edited.')
    if (record.updatedAt.toISOString() !== input.expectedUpdatedAt) throw domainError(409, 'This review changed in another session. Reload before saving.')
    for (const candidate of input.candidates || []) {
      const { id, ...data } = candidate
      const result = await tx.courseOutlineAssessmentCandidate.updateMany({ where: { id, importId }, data })
      if (!result.count) throw domainError(404, 'Assessment candidate not found.')
    }
    if (input.newCandidates?.length) {
      const maximum = await tx.courseOutlineAssessmentCandidate.aggregate({ where: { importId }, _max: { sourceOrder: true } })
      await tx.courseOutlineAssessmentCandidate.createMany({
        data: input.newCandidates.map((candidate, index) => ({ importId, sourceOrder: (maximum._max.sourceOrder || 0) + index + 1, ...candidate }))
      })
    }
    for (const fact of input.facts || []) {
      const { id, ...data } = fact
      const result = await tx.courseOutlineFact.updateMany({ where: { id, importId }, data })
      if (!result.count) throw domainError(404, 'Course outline field not found.')
    }
    for (const week of input.weeks || []) {
      const { id, ...data } = week
      const result = await tx.courseOutlineWeek.updateMany({ where: { id, importId }, data })
      if (!result.count) throw domainError(404, 'Weekly topic not found.')
    }
    if (input.userConfirmedCurrent !== undefined) await tx.courseOutlineImport.update({ where: { id: importId }, data: { userConfirmedCurrent: input.userConfirmedCurrent } })
    return serializeImport(await tx.courseOutlineImport.findUnique({ where: { id: importId }, include: importInclude }))
  })
}

function duplicateWhere(enrolmentId, candidate) {
  return {
    userModuleEnrolmentId: enrolmentId,
    normalizedName: normalizeAssessmentName(candidate.name),
    type: candidate.type,
    officialDeadline: candidate.officialDeadline,
    weight: candidate.weight
  }
}

export async function confirmCourseOutlineImport(userId, importId, input, database = prisma) {
  return transaction(database, async tx => {
    const record = await tx.courseOutlineImport.findFirst({ where: { id: importId, userId }, include: { candidates: { where: { status: 'SELECTED' }, include: { provenance: true } }, assessments: true } })
    if (!record) throw domainError(404, 'Course outline import not found.')
    if (record.status === 'CONFIRMED') return { status: 'CONFIRMED', createdCount: 0, assessmentIds: record.assessments.map(item => item.id), idempotent: true }
    if (record.status !== 'REVIEW_REQUIRED') throw domainError(409, 'This import cannot be confirmed.')
    if (record.updatedAt.toISOString() !== input.expectedUpdatedAt) throw domainError(409, 'This review changed in another session. Reload before confirming.')
    if (!record.candidates.length) throw domainError(400, 'Select at least one assessment to confirm.')
    if (record.candidates.some(candidate => !candidate.name || !candidate.type)) throw domainError(400, 'Every selected assessment needs a name and type.')

    const conflicts = []
    for (const candidate of record.candidates) {
      const duplicate = await tx.assessment.findFirst({ where: duplicateWhere(record.userModuleEnrolmentId, candidate), select: { id: true, name: true } })
      if (duplicate) conflicts.push({ candidateId: candidate.id, assessmentId: duplicate.id, name: duplicate.name })
    }
    if (conflicts.length) throw domainError(409, 'One or more assessments conflict with confirmed records. Reject or edit them before confirming.', { conflicts })

    const confirmedAt = new Date()
    const assessmentIds = []
    for (const candidate of record.candidates) {
      const created = await tx.assessment.create({
        data: {
          userId,
          userModuleEnrolmentId: record.userModuleEnrolmentId,
          sourceImportId: record.id,
          sourceCandidateId: candidate.id,
          ...assessmentData({
            name: candidate.name,
            type: candidate.type,
            weight: candidate.weight,
            officialDeadline: candidate.officialDeadline,
            eventDate: candidate.eventDate,
            submissionPlatform: candidate.submissionPlatform,
            submissionUrl: candidate.submissionUrl,
            instructions: candidate.instructions,
            examFormat: candidate.examFormat,
            groupAssessment: candidate.groupAssessment
          }),
          deliverables: { create: candidate.deliverables.map((title, sortOrder) => ({ title, sortOrder })) },
          provenance: {
            create: candidate.provenance.map(source => ({
              sourceImportId: record.id,
              fieldName: source.fieldName,
              originalFileName: record.originalFileName,
              sourceLabel: record.sourceLabel,
              sourceType: record.sourceType,
              pageNumber: source.pageNumber,
              sectionHeading: source.sectionHeading,
              sourceExcerpt: source.sourceExcerpt,
              confidence: source.confidence,
              confirmedAt
            }))
          }
        }
      })
      assessmentIds.push(created.id)
    }
    await tx.courseOutlineImport.update({ where: { id: importId }, data: { status: 'CONFIRMED', confirmedAt } })
    return { status: 'CONFIRMED', createdCount: assessmentIds.length, assessmentIds, idempotent: false }
  })
}

export async function deleteCourseOutlineImport(userId, importId, database = prisma) {
  const record = await database.courseOutlineImport.findFirst({ where: { id: importId, userId }, include: { _count: { select: { assessments: true } } } })
  if (!record) throw domainError(404, 'Course outline import not found.')
  if (record._count.assessments) throw domainError(409, 'This import is referenced by confirmed assessments and must be preserved.')
  if (!['FAILED', 'CANCELLED', 'REVIEW_REQUIRED'].includes(record.status)) throw domainError(409, 'This import cannot be deleted.')
  await database.courseOutlineImport.delete({ where: { id: importId } })
  return { deleted: true }
}

export async function cancelCourseOutlineImport(userId, importId, database = prisma) {
  const result = await database.courseOutlineImport.updateMany({ where: { id: importId, userId, status: 'REVIEW_REQUIRED' }, data: { status: 'CANCELLED' } })
  if (!result.count) throw domainError(404, 'Unfinished course outline import not found.')
  return { status: 'CANCELLED' }
}

export async function listAssessments(userId, enrolmentId, database = prisma) {
  const enrolment = await requireEnrolment(database, userId, enrolmentId)
  const assessments = await database.assessment.findMany({ where: { userId, userModuleEnrolmentId: enrolmentId }, include: assessmentInclude, orderBy: [{ officialDeadline: 'asc' }, { createdAt: 'asc' }] })
  return {
    targetPercentage: decimal(enrolment.targetPercentage),
    targetLabel: enrolment.targetLabel,
    assessments: assessments.map(serializeAssessment)
  }
}

export async function createAssessment(userId, enrolmentId, input, database = prisma) {
  await requireEnrolment(database, userId, enrolmentId)
  const created = await database.assessment.create({ data: { userId, userModuleEnrolmentId: enrolmentId, ...assessmentData(input) }, include: assessmentInclude })
  return serializeAssessment(created)
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
  if (merged.internalDeadline && merged.officialDeadline && new Date(merged.internalDeadline) > new Date(merged.officialDeadline)) {
    throw domainError(400, 'Internal deadline must not be after the official deadline.')
  }
  if ((merged.score === null) !== (merged.maximumScore === null)) throw domainError(400, 'Score and maximum score must be provided together.')
  if (merged.score !== null && merged.maximumScore !== null && Number(merged.score) > Number(merged.maximumScore)) {
    throw domainError(400, 'Score cannot exceed the maximum score.')
  }
  const updated = await database.assessment.update({ where: { id: assessmentId }, data: assessmentData(merged), include: assessmentInclude })
  return serializeAssessment(updated)
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

export async function createDeliverable(userId, assessmentId, input, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  return database.assessmentDeliverable.create({ data: { assessmentId, ...input } })
}
export async function updateDeliverable(userId, assessmentId, id, input, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  const result = await database.assessmentDeliverable.updateMany({ where: { id, assessmentId }, data: input })
  if (!result.count) throw domainError(404, 'Deliverable not found.')
  return database.assessmentDeliverable.findUnique({ where: { id } })
}
export async function deleteDeliverable(userId, assessmentId, id, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  const result = await database.assessmentDeliverable.deleteMany({ where: { id, assessmentId } })
  if (!result.count) throw domainError(404, 'Deliverable not found.')
  return { deleted: true }
}
export async function createMilestone(userId, assessmentId, input, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  return database.assessmentMilestone.create({ data: { assessmentId, ...input } })
}
export async function updateMilestone(userId, assessmentId, id, input, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  const result = await database.assessmentMilestone.updateMany({ where: { id, assessmentId }, data: input })
  if (!result.count) throw domainError(404, 'Milestone not found.')
  return database.assessmentMilestone.findUnique({ where: { id } })
}
export async function deleteMilestone(userId, assessmentId, id, database = prisma) {
  await requireAssessment(database, userId, assessmentId)
  const result = await database.assessmentMilestone.deleteMany({ where: { id, assessmentId } })
  if (!result.count) throw domainError(404, 'Milestone not found.')
  return { deleted: true }
}
