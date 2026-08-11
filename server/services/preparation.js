import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { derivePreparationReadiness, normalizePreparation } from '#shared/academic/preparation'
import { teachingWeekSchema } from '#shared/schemas/preparation'

const dateValue = value => value instanceof Date ? value.toISOString() : value ?? null
const domainError = (statusCode, statusMessage) => createError({ statusCode, statusMessage })

export function parseTeachingWeek(value) {
  const parsed = teachingWeekSchema.safeParse(value)
  if (!parsed.success) throw domainError(400, 'Teaching week must be an integer from 1 to 52.')
  return parsed.data
}

function serializePreparation(record, enrolmentId, teachingWeek) {
  const normalized = normalizePreparation(record)
  return {
    id: record?.id || null,
    userModuleEnrolmentId: enrolmentId,
    teachingWeek,
    materialStatus: normalized.materialStatus,
    notesStatus: normalized.notesStatus,
    requiredWorkStatus: normalized.requiredWorkStatus,
    practiceStatus: normalized.practiceStatus,
    questions: normalized.questions,
    readiness: derivePreparationReadiness(normalized),
    persisted: Boolean(record?.id),
    createdAt: dateValue(record?.createdAt),
    updatedAt: dateValue(record?.updatedAt)
  }
}

async function activeSemesterFor(userId, database) {
  const semester = await database.userSemester.findFirst({
    where: { userId, isActive: true },
    include: { academicTerm: true }
  })
  if (!semester) throw domainError(409, 'Select an active semester before tracking class preparation.')
  return semester
}

async function ownedActiveEnrolment(userId, enrolmentId, database) {
  const semester = await activeSemesterFor(userId, database)
  const enrolment = await database.userModuleEnrolment.findFirst({
    where: { id: enrolmentId, userId, userSemesterId: semester.id, status: 'ACTIVE' },
    include: { offering: { include: { module: true } } }
  })
  if (!enrolment) throw domainError(404, 'Active module enrolment not found.')
  return { semester, enrolment }
}

export async function listPreparation(userId, database = prisma) {
  const semester = await activeSemesterFor(userId, database)
  const enrolments = await database.userModuleEnrolment.findMany({
    where: { userId, userSemesterId: semester.id, status: 'ACTIVE' },
    include: {
      offering: { include: { module: true } },
      weekPreparations: { where: { userId }, orderBy: { teachingWeek: 'asc' } }
    },
    orderBy: { offering: { module: { code: 'asc' } } }
  })
  return {
    semester: {
      id: semester.id,
      academicYear: semester.academicTerm.academicYear,
      name: semester.academicTerm.name,
      teachingStartDate: dateValue(semester.academicTerm.teachingStartDate),
      teachingEndDate: dateValue(semester.academicTerm.endDate)
    },
    modules: enrolments.map(enrolment => ({
      enrolmentId: enrolment.id,
      module: { id: enrolment.offering.module.id, code: enrolment.offering.module.code, title: enrolment.offering.module.title },
      preparations: enrolment.weekPreparations.map(record => serializePreparation(record, enrolment.id, record.teachingWeek))
    }))
  }
}

export async function getPreparation(userId, enrolmentId, week, database = prisma) {
  const teachingWeek = parseTeachingWeek(week)
  await ownedActiveEnrolment(userId, enrolmentId, database)
  const record = await database.moduleWeekPreparation.findFirst({
    where: { userId, userModuleEnrolmentId: enrolmentId, teachingWeek }
  })
  return serializePreparation(record, enrolmentId, teachingWeek)
}

export async function updatePreparation(userId, enrolmentId, week, input, database = prisma) {
  const teachingWeek = parseTeachingWeek(week)
  const operation = async transaction => {
    await ownedActiveEnrolment(userId, enrolmentId, transaction)
    const record = await transaction.moduleWeekPreparation.upsert({
      where: { userModuleEnrolmentId_teachingWeek: { userModuleEnrolmentId: enrolmentId, teachingWeek } },
      update: input,
      create: { userId, userModuleEnrolmentId: enrolmentId, teachingWeek, ...input }
    })
    if (record.userId !== userId) throw domainError(403, 'Preparation record ownership mismatch.')
    return serializePreparation(record, enrolmentId, teachingWeek)
  }
  return database.$transaction
    ? database.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 })
    : operation(database)
}
