import { buildTimetableEvents, dateKey } from '../shared/calendar/events.js'

export const FORCE_SEMESTER_EMAIL = 'gavarasanasrisaisaranya@gmail.com'
export const AUTHORITATIVE_TEACHING_START = '2026-08-10'

function normalizedAssessmentName(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export async function resolveForceSemesterTarget(database) {
  const user = await database.user.findUnique({ where: { email: FORCE_SEMESTER_EMAIL } })
  if (!user) throw new Error(`User ${FORCE_SEMESTER_EMAIL} does not exist.`)

  const academicProfile = await database.userAcademicProfile.findUnique({ where: { userId: user.id } })
  if (!academicProfile) throw new Error(`User ${FORCE_SEMESTER_EMAIL} has no academic profile.`)

  const userSemester = await database.userSemester.findFirst({
    where: { userId: user.id, isActive: true },
    include: { academicTerm: true },
    orderBy: { updatedAt: 'desc' }
  })
  if (!userSemester) throw new Error(`User ${FORCE_SEMESTER_EMAIL} has no active semester.`)

  return { user, academicProfile, userSemester }
}

export async function setAuthoritativeTeachingStart(database, target) {
  const teachingStartDate = new Date(`${AUTHORITATIVE_TEACHING_START}T00:00:00+08:00`)
  await database.academicTerm.update({
    where: { id: target.userSemester.academicTermId },
    data: { teachingStartDate }
  })
  target.userSemester.academicTerm = { ...target.userSemester.academicTerm, teachingStartDate }
}

async function upsertModule(database, target, expected) {
  return database.module.upsert({
    where: { universityId_code: { universityId: target.academicProfile.universityId, code: expected.code } },
    update: { title: expected.title, academicUnits: expected.academicUnits },
    create: {
      universityId: target.academicProfile.universityId,
      schoolId: target.academicProfile.schoolId,
      code: expected.code,
      title: expected.title,
      academicUnits: expected.academicUnits,
      sourceStatus: 'USER_ENTERED',
      verificationStatus: 'USER_CONFIRMED'
    }
  })
}

async function upsertExam(database, target, enrolment, expected) {
  if (!expected.exam) return
  const existing = await database.assessment.findFirst({
    where: { userId: target.user.id, userModuleEnrolmentId: enrolment.id, type: 'FINAL_EXAMINATION' },
    orderBy: { createdAt: 'asc' }
  })
  const data = {
    userId: target.user.id,
    userModuleEnrolmentId: enrolment.id,
    name: 'Final Examination',
    normalizedName: normalizedAssessmentName('Final Examination'),
    type: 'FINAL_EXAMINATION',
    officialDeadline: null,
    eventDate: new Date(expected.exam.start),
    eventEndDate: new Date(expected.exam.end),
    status: 'NOT_STARTED'
  }
  if (existing) await database.assessment.update({ where: { id: existing.id }, data })
  else await database.assessment.create({ data })
}

async function upsertEnrolment(database, target, expected) {
  const module = await upsertModule(database, target, expected)
  const offering = await database.moduleOffering.upsert({
    where: { moduleId_academicTermId_sectionLabel: { moduleId: module.id, academicTermId: target.userSemester.academicTermId, sectionLabel: 'DEFAULT' } },
    update: {},
    create: { moduleId: module.id, academicTermId: target.userSemester.academicTermId, sectionLabel: 'DEFAULT' }
  })
  const enrolment = await database.userModuleEnrolment.upsert({
    where: { userId_offeringId: { userId: target.user.id, offeringId: offering.id } },
    update: { userSemesterId: target.userSemester.id, indexNumber: expected.indexNumber, status: 'ACTIVE', registrationStatus: 'REGISTERED' },
    create: { userId: target.user.id, userSemesterId: target.userSemester.id, offeringId: offering.id, indexNumber: expected.indexNumber, status: 'ACTIVE', registrationStatus: 'REGISTERED' }
  })
  await upsertExam(database, target, enrolment, expected)
  return enrolment
}

export async function synchronizeCurrentSemester(database, target, seed) {
  const enrolments = []
  for (const module of seed.modules) enrolments.push(await upsertEnrolment(database, target, module))
  const enrolmentIds = enrolments.map(enrolment => enrolment.id)

  await database.classSession.deleteMany({
    where: {
      userModuleEnrolmentId: { in: enrolmentIds },
      userModuleEnrolment: { userId: target.user.id, userSemesterId: target.userSemester.id }
    }
  })

  for (let index = 0; index < seed.modules.length; index += 1) {
    for (const session of seed.modules[index].sessions) {
      await database.classSession.create({
        data: { userModuleEnrolmentId: enrolments[index].id, ...session, source: 'MANUAL' }
      })
    }
  }
  return enrolmentIds
}

export function teachingWeekMappingStatus(academicTerm, sessions) {
  const missingFields = []
  if (!dateKey(academicTerm?.teachingStartDate)) missingFields.push('teachingStartDate')
  if (!dateKey(academicTerm?.endDate)) missingFields.push('endDate')
  if (missingFields.length) return { safe: false, missingFields, occurrenceCount: 0 }
  const events = buildTimetableEvents({
    sessions,
    activeSemester: {
      teachingStartDate: academicTerm.teachingStartDate,
      teachingEndDate: academicTerm.endDate,
      recessStartDate: academicTerm.recessStartDate,
      recessEndDate: academicTerm.recessEndDate
    }
  })
  return { safe: events.length > 0, missingFields: [], occurrenceCount: events.length }
}

export async function loadForceSemesterDiagnostics(database, target, seed) {
  const codes = seed.modules.map(module => module.code)
  const enrolments = await database.userModuleEnrolment.findMany({
    where: {
      userId: target.user.id,
      userSemesterId: target.userSemester.id,
      offering: {
        academicTermId: target.userSemester.academicTermId,
        sectionLabel: 'DEFAULT',
        module: { code: { in: codes } }
      }
    },
    include: {
      offering: { include: { module: true } },
      classSessions: { orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }] }
    }
  })
  const sessions = enrolments.flatMap(enrolment => enrolment.classSessions.map(session => ({
    ...session,
    enrolmentId: enrolment.id,
    module: { code: enrolment.offering.module.code, title: enrolment.offering.module.title }
  })))
  return {
    activeSemester: `${target.userSemester.academicTerm.academicYear} · ${target.userSemester.academicTerm.name}`,
    teachingStartDate: target.userSemester.academicTerm.teachingStartDate,
    endDate: target.userSemester.academicTerm.endDate,
    sessions,
    counts: Object.fromEntries(codes.map(code => [code, sessions.filter(session => session.module.code === code).length])),
    mapping: teachingWeekMappingStatus(target.userSemester.academicTerm, sessions)
  }
}
