import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { requireModuleContext } from './modules'
import { timetableStructureIssues } from '../../shared/utils/timetable-structure'

const SESSION_INCLUDE = { userModuleEnrolment: { include: { offering: { include: { module: true, academicTerm: true } } } } }

function domainError(statusCode, statusMessage) { return createError({ statusCode, statusMessage }) }
function dateValue(value) { return value instanceof Date ? value.toISOString() : value }
function decimalValue(value) { return value === null || value === undefined ? null : Number(value) }

async function runTransaction(database, operation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 })
    } catch (error) {
      if (attempt === 0 && ['P2028', 'P2034'].includes(error?.code)) continue
      throw error
    }
  }
}

function selectedCounts(modules) {
  return { detectedModuleCount: modules.length, detectedSessionCount: modules.reduce((count, module) => count + module.sessions.length, 0) }
}

export function sourceSemesterStatus(sourceSemester, academicTerm) {
  if (!sourceSemester) return 'UNKNOWN'
  const semesterNumber = academicTerm?.semesterNumber ?? Number(String(academicTerm?.name || '').match(/\d+/)?.[0])
  return academicTerm?.academicYear === sourceSemester.academicYearLabel && semesterNumber === sourceSemester.semesterNumber ? 'MATCH' : 'MISMATCH'
}

function targetSemester(activeSemester) {
  const term = activeSemester.academicTerm
  return { userSemesterId: activeSemester.id, academicYearLabel: term.academicYear, semesterNumber: term.semesterNumber ?? (Number(String(term.name).match(/\d+/)?.[0]) || null), displayLabel: `${term.academicYear} ${term.name}` }
}

function serializeImport(record) {
  return { id: record.id, source: record.source, status: record.status, parserVersion: record.parserVersion, ...record.candidatePayload, warnings: record.warnings || [], detectedModuleCount: record.detectedModuleCount, detectedSessionCount: record.detectedSessionCount, confirmedAt: dateValue(record.confirmedAt), createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt) }
}

export async function createTimetableImport(userId, input, database = prisma) {
  const { activeSemester } = await requireModuleContext(userId, database)
  const counts = selectedCounts(input.modules)
  const { source, warnings, ...candidatePayload } = input
  candidatePayload.semesterMatchStatus = sourceSemesterStatus(input.sourceSemester, activeSemester.academicTerm)
  candidatePayload.targetSemester = targetSemester(activeSemester)
  const record = await database.timetableImport.create({ data: { userId, userSemesterId: activeSemester.id, source, status: 'NEEDS_REVIEW', parserVersion: 'northstar-ntu-image-2', candidatePayload, warnings, ...counts } })
  return serializeImport(record)
}

export async function getTimetableImport(userId, id, database = prisma) {
  const record = await database.timetableImport.findFirst({ where: { id, userId } })
  if (!record) throw domainError(404, 'Timetable import not found.')
  return serializeImport(record)
}

export async function updateTimetableImport(userId, id, input, database = prisma) {
  const record = await database.timetableImport.findFirst({ where: { id, userId } })
  if (!record) throw domainError(404, 'Timetable import not found.')
  if (record.status !== 'NEEDS_REVIEW') throw domainError(409, 'Only an import awaiting review can be changed.')
  const counts = selectedCounts(input.modules)
  return serializeImport(await database.timetableImport.update({ where: { id }, data: { candidatePayload: { ...record.candidatePayload, modules: input.modules, unmatchedTimetableText: input.unmatchedTimetableText }, warnings: input.warnings, ...counts } }))
}

export async function cancelTimetableImport(userId, id, database = prisma) {
  const record = await database.timetableImport.findFirst({ where: { id, userId } })
  if (!record) throw domainError(404, 'Timetable import not found.')
  if (record.status === 'CONFIRMED') throw domainError(409, 'A confirmed import cannot be deleted here.')
  await database.timetableImport.delete({ where: { id } })
  return { cancelled: true }
}

function recurrenceWeeks(session) {
  if (session.recurrence === 'ODD_WEEKS') return Array.from({ length: 26 }, (_, index) => index * 2 + 1)
  if (session.recurrence === 'EVEN_WEEKS') return Array.from({ length: 26 }, (_, index) => index * 2 + 2)
  if (session.recurrence === 'CUSTOM') return session.weekNumbers
  return Array.from({ length: 52 }, (_, index) => index + 1)
}

function overlap(left, right) {
  const weeks = new Set(recurrenceWeeks(right))
  return left.dayOfWeek === right.dayOfWeek && left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes && recurrenceWeeks(left).some(week => weeks.has(week))
}

function serializeSession(session) {
  const enrolment = session.userModuleEnrolment
  return { id: session.id, enrolmentId: session.userModuleEnrolmentId, classType: session.classType, groupLabel: session.groupLabel, dayOfWeek: session.dayOfWeek, startMinutes: session.startMinutes, endMinutes: session.endMinutes, venue: session.venue, deliveryMode: session.deliveryMode, recurrence: session.recurrence, weekNumbers: session.weekNumbers, source: session.source, confidence: decimalValue(session.confidence), module: enrolment ? { id: enrolment.offering.module.id, code: enrolment.offering.module.code, title: enrolment.offering.module.title, colour: enrolment.colour } : undefined }
}

function conflictPairs(sessions) {
  const result = []
  for (let left = 0; left < sessions.length; left += 1) for (let right = left + 1; right < sessions.length; right += 1) if (overlap(sessions[left], sessions[right])) result.push({ firstSessionId: sessions[left].id, secondSessionId: sessions[right].id })
  return result
}

export async function confirmTimetableImport(userId, id, input, database = prisma) {
  return runTransaction(database, async (transaction) => {
    const record = await transaction.timetableImport.findFirst({ where: { id, userId } })
    if (!record) throw domainError(404, 'Timetable import not found.')
    if (record.status === 'CONFIRMED') throw domainError(409, 'This import has already been confirmed.')
    if (record.status !== 'NEEDS_REVIEW') throw domainError(409, 'This import is not ready for confirmation.')
    if (dateValue(record.updatedAt) !== input.expectedUpdatedAt) throw domainError(409, 'This review changed in another tab. Reload it before confirming.')
    const { academicProfile, activeSemester } = await requireModuleContext(userId, transaction)
    if (record.userSemesterId !== activeSemester.id) throw domainError(409, 'This import targets a different semester. Cancel it and review the upload again after selecting the matching semester.')
    const semesterStatus = sourceSemesterStatus(record.candidatePayload.sourceSemester, activeSemester.academicTerm)
    if (semesterStatus !== 'MATCH') throw domainError(409, semesterStatus === 'MISMATCH' ? `Semester mismatch: the upload is for ${record.candidatePayload.sourceSemester.displayLabel}, but the selected target is ${activeSemester.academicTerm.academicYear} ${activeSemester.academicTerm.name}.` : 'Select a target semester explicitly before confirming this import.')
    if (timetableStructureIssues(input.modules, record.candidatePayload).length) throw domainError(409, 'Resolve the structural timetable import issues before confirming.')
    let modulesCreated = 0
    let modulesReused = 0
    let sessionsCreated = 0
    let duplicatesSkipped = 0

    for (const candidate of input.modules.filter(module => module.selected)) {
      const code = candidate.code.trim().toUpperCase()
      let module = await transaction.module.findUnique({ where: { universityId_code: { universityId: academicProfile.universityId, code } } })
      if (!module) {
        if (!candidate.title) throw domainError(400, `${code} needs a title before it can be created.`)
        module = await transaction.module.create({ data: { universityId: academicProfile.universityId, schoolId: academicProfile.schoolId, code, title: candidate.title, academicUnits: candidate.academicUnits, description: candidate.publicEnrichment?.description, gradingBasis: candidate.publicEnrichment?.gradingBasis, officialUrl: candidate.publicEnrichment?.officialUrl, sourceStatus: 'USER_ENTERED', verificationStatus: candidate.publicEnrichment?.verificationStatus || 'USER_CONFIRMED', enrichmentProvenance: candidate.publicEnrichment?.fieldProvenance, lastVerifiedAt: candidate.publicEnrichment ? new Date() : null } })
        modulesCreated += 1
      } else {
        modulesReused += 1
        if (!module.sourceStatus.startsWith('OFFICIAL_')) {
          const safeUpdates = {}
          if (module.academicUnits === null && candidate.academicUnits !== null) safeUpdates.academicUnits = candidate.academicUnits
          if (!module.description && candidate.publicEnrichment?.description) safeUpdates.description = candidate.publicEnrichment.description
          if (!module.gradingBasis && candidate.publicEnrichment?.gradingBasis) safeUpdates.gradingBasis = candidate.publicEnrichment.gradingBasis
          if (!module.officialUrl && candidate.publicEnrichment?.officialUrl) safeUpdates.officialUrl = candidate.publicEnrichment.officialUrl
          if (candidate.publicEnrichment) {
            safeUpdates.enrichmentProvenance = candidate.publicEnrichment.fieldProvenance
            safeUpdates.verificationStatus = candidate.publicEnrichment.verificationStatus
            safeUpdates.lastVerifiedAt = new Date()
          }
          if (Object.keys(safeUpdates).length) module = await transaction.module.update({ where: { id: module.id }, data: safeUpdates })
        }
      }
      const offering = await transaction.moduleOffering.upsert({ where: { moduleId_academicTermId_sectionLabel: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel: 'DEFAULT' } }, update: {}, create: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel: 'DEFAULT' } })
      const existingEnrolment = await transaction.userModuleEnrolment.findUnique({ where: { userId_offeringId: { userId, offeringId: offering.id } } })
      const enrolment = existingEnrolment
        ? await transaction.userModuleEnrolment.update({ where: { id: existingEnrolment.id }, data: { indexNumber: candidate.indexNumber, courseType: candidate.courseType, registrationStatus: candidate.registrationStatus, status: 'ACTIVE' } })
        : await transaction.userModuleEnrolment.create({ data: { userId, userSemesterId: activeSemester.id, offeringId: offering.id, indexNumber: candidate.indexNumber, courseType: candidate.courseType, registrationStatus: candidate.registrationStatus } })
      if (candidate.registrationStatus === 'EXEMPTED') continue
      for (const session of candidate.sessions.filter(item => item.selected)) {
        const key = { userModuleEnrolmentId: enrolment.id, classType: session.classType, groupLabel: session.groupLabel, dayOfWeek: session.dayOfWeek, startMinutes: session.startMinutes, endMinutes: session.endMinutes }
        const duplicate = await transaction.classSession.findUnique({ where: { userModuleEnrolmentId_classType_groupLabel_dayOfWeek_startMinutes_endMinutes: key } })
        if (duplicate) { duplicatesSkipped += 1; continue }
        await transaction.classSession.create({ data: { ...key, venue: session.venue, deliveryMode: session.deliveryMode, recurrence: session.recurrence, weekNumbers: session.recurrence === 'CUSTOM' ? session.weekNumbers : [], source: 'IMPORTED', confidence: session.confidence } })
        sessionsCreated += 1
      }
    }
    const sessions = await transaction.classSession.findMany({ where: { userModuleEnrolment: { userId, userSemesterId: activeSemester.id, status: 'ACTIVE' } }, include: SESSION_INCLUDE })
    const conflicts = conflictPairs(sessions)
    await transaction.timetableImport.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), candidatePayload: { ...record.candidatePayload, modules: input.modules } } })
    return { modulesCreated, modulesReused, sessionsCreated, duplicatesSkipped, conflicts }
  })
}

export async function listTimetable(userId, database = prisma) {
  const { activeSemester } = await requireModuleContext(userId, database)
  const records = await database.classSession.findMany({ where: { userModuleEnrolment: { userId, userSemesterId: activeSemester.id, status: 'ACTIVE' } }, include: SESSION_INCLUDE, orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }] })
  const sessions = records.map(serializeSession)
  const days = Object.fromEntries(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(day => [day, sessions.filter(session => session.dayOfWeek === day)]))
  return { activeSemester: { id: activeSemester.id, label: `${activeSemester.academicTerm.academicYear} · ${activeSemester.academicTerm.name}`, teachingStartDate: dateValue(activeSemester.academicTerm.teachingStartDate), teachingEndDate: dateValue(activeSemester.academicTerm.endDate) }, days, sessions, conflicts: conflictPairs(sessions), currentDate: new Date().toISOString() }
}

async function ownedEnrolment(userId, enrolmentId, database) {
  const enrolment = await database.userModuleEnrolment.findFirst({ where: { id: enrolmentId, userId } })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  return enrolment
}

export async function createClassSession(userId, enrolmentId, input, database = prisma) {
  await ownedEnrolment(userId, enrolmentId, database)
  try { return serializeSession(await database.classSession.create({ data: { userModuleEnrolmentId: enrolmentId, ...input, source: 'MANUAL' }, include: SESSION_INCLUDE })) } catch (error) { if (error?.code === 'P2002') throw domainError(409, 'That class session already exists.'); throw error }
}

export async function updateClassSession(userId, id, input, database = prisma) {
  const record = await database.classSession.findFirst({ where: { id, userModuleEnrolment: { userId } } })
  if (!record) throw domainError(404, 'Class session not found.')
  const merged = { ...record, ...input }
  if (merged.endMinutes <= merged.startMinutes) throw domainError(400, 'End time must be after start time.')
  if (merged.recurrence !== 'CUSTOM') input.weekNumbers = []
  try { return serializeSession(await database.classSession.update({ where: { id }, data: input, include: SESSION_INCLUDE })) } catch (error) { if (error?.code === 'P2002') throw domainError(409, 'That class session already exists.'); throw error }
}

export async function deleteClassSession(userId, id, database = prisma) {
  const record = await database.classSession.findFirst({ where: { id, userModuleEnrolment: { userId } } })
  if (!record) throw domainError(404, 'Class session not found.')
  await database.classSession.delete({ where: { id } })
  return { deleted: true }
}
