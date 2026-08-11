import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../server/generated/prisma/client.js'
import { CURRENT_SEMESTER_SEED, classSessionIdentity, validateCurrentSemesterSeed } from './current-semester-seed-data.js'

const connectionString = process.env.DATABASE_URL
const requestedEmail = String(process.env.SEED_USER_EMAIL || '').trim()

if (!connectionString) throw new Error('DATABASE_URL is required.')
if (!requestedEmail) throw new Error('SEED_USER_EMAIL is required. Example: SEED_USER_EMAIL="you@example.com" npm run seed:semester')

validateCurrentSemesterSeed()
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

function normalizedAssessmentName(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function moduleConflict(existing, expected) {
  return existing.title !== expected.title || Number(existing.academicUnits) !== expected.academicUnits
}

async function resolveSeedTarget(database) {
  const users = await database.user.findMany({
    where: { email: { equals: requestedEmail, mode: 'insensitive' } },
    take: 2,
    include: { academicProfile: true }
  })
  if (!users.length) throw new Error(`No user exists for SEED_USER_EMAIL=${requestedEmail}.`)
  if (users.length > 1) throw new Error(`Multiple users match SEED_USER_EMAIL=${requestedEmail}; refusing to choose one.`)
  const user = users[0]
  if (!user.academicProfile) throw new Error('The selected user has no academic profile.')

  const terms = await database.academicTerm.findMany({
    where: {
      universityId: user.academicProfile.universityId,
      academicYear: CURRENT_SEMESTER_SEED.academicYear,
      OR: [
        { semesterNumber: CURRENT_SEMESTER_SEED.semesterNumber },
        { name: { equals: CURRENT_SEMESTER_SEED.termName, mode: 'insensitive' } }
      ]
    },
    take: 3
  })
  if (!terms.length) throw new Error(`No ${CURRENT_SEMESTER_SEED.academicYear} ${CURRENT_SEMESTER_SEED.termName} academic term exists for the selected user's university.`)
  if (terms.length > 1) throw new Error(`Multiple academic terms could represent ${CURRENT_SEMESTER_SEED.academicYear} ${CURRENT_SEMESTER_SEED.termName}; refusing to choose one.`)
  const academicTerm = terms[0]

  const activeSemesters = await database.userSemester.findMany({ where: { userId: user.id, isActive: true }, take: 2 })
  if (!activeSemesters.length) throw new Error('The selected user has no active semester.')
  if (activeSemesters.length > 1) throw new Error('The selected user has multiple active semesters; refusing to choose one.')
  if (activeSemesters[0].academicTermId !== academicTerm.id) throw new Error(`The selected user's active semester is not ${CURRENT_SEMESTER_SEED.academicYear} ${CURRENT_SEMESTER_SEED.termName}.`)

  return { user, academicProfile: user.academicProfile, academicTerm, userSemester: activeSemesters[0] }
}

async function upsertModule(database, target, expected) {
  let module = await database.module.findUnique({ where: { universityId_code: { universityId: target.academicProfile.universityId, code: expected.code } } })
  if (!module) {
    module = await database.module.create({
      data: {
        universityId: target.academicProfile.universityId, schoolId: target.academicProfile.schoolId,
        code: expected.code, title: expected.title, academicUnits: expected.academicUnits,
        sourceStatus: 'USER_ENTERED', verificationStatus: 'USER_CONFIRMED'
      }
    })
  } else if (moduleConflict(module, expected)) {
    if (module.sourceStatus.startsWith('OFFICIAL_')) throw new Error(`${expected.code} has official module details that conflict with the seed; refusing to overwrite them.`)
    module = await database.module.update({ where: { id: module.id }, data: { title: expected.title, academicUnits: expected.academicUnits, schoolId: module.schoolId || target.academicProfile.schoolId } })
  }
  return module
}

async function upsertExam(database, target, enrolment, expected) {
  const exams = await database.assessment.findMany({ where: { userId: target.user.id, userModuleEnrolmentId: enrolment.id, type: 'FINAL_EXAMINATION' }, take: 2 })
  if (!expected.exam) {
    if (exams.length) throw new Error(`${expected.code} is marked as having no exam, but an existing final-examination assessment was found.`)
    return null
  }
  if (exams.length > 1) throw new Error(`${expected.code} has multiple final-examination assessments; refusing to choose one.`)
  const data = {
    userId: target.user.id, userModuleEnrolmentId: enrolment.id,
    name: 'Final Examination', normalizedName: normalizedAssessmentName('Final Examination'), type: 'FINAL_EXAMINATION',
    officialDeadline: null, eventDate: new Date(expected.exam.start), eventEndDate: new Date(expected.exam.end), status: 'NOT_STARTED'
  }
  return exams[0]
    ? database.assessment.update({ where: { id: exams[0].id }, data })
    : database.assessment.create({ data })
}

async function seedModule(database, target, expected) {
  const module = await upsertModule(database, target, expected)
  const offering = await database.moduleOffering.upsert({
    where: { moduleId_academicTermId_sectionLabel: { moduleId: module.id, academicTermId: target.academicTerm.id, sectionLabel: 'DEFAULT' } },
    update: {}, create: { moduleId: module.id, academicTermId: target.academicTerm.id, sectionLabel: 'DEFAULT' }
  })
  const enrolment = await database.userModuleEnrolment.upsert({
    where: { userId_offeringId: { userId: target.user.id, offeringId: offering.id } },
    update: { userSemesterId: target.userSemester.id, indexNumber: expected.indexNumber, status: 'ACTIVE', registrationStatus: 'REGISTERED' },
    create: { userId: target.user.id, userSemesterId: target.userSemester.id, offeringId: offering.id, indexNumber: expected.indexNumber, status: 'ACTIVE', registrationStatus: 'REGISTERED' }
  })

  for (const session of expected.sessions) {
    await database.classSession.upsert({
      where: { userModuleEnrolmentId_classType_groupLabel_dayOfWeek_startMinutes_endMinutes: { userModuleEnrolmentId: enrolment.id, classType: session.classType, groupLabel: session.groupLabel, dayOfWeek: session.dayOfWeek, startMinutes: session.startMinutes, endMinutes: session.endMinutes } },
      update: { venue: session.venue, recurrence: session.recurrence, weekNumbers: session.weekNumbers, deliveryMode: session.deliveryMode, source: 'MANUAL' },
      create: { userModuleEnrolmentId: enrolment.id, ...session, source: 'MANUAL' }
    })
  }
  await upsertExam(database, target, enrolment, expected)
  return { module, enrolment }
}

async function verifySeed(database, target, seeded) {
  const rows = await database.userModuleEnrolment.findMany({
    where: { id: { in: seeded.map(item => item.enrolment.id) }, userId: target.user.id, userSemesterId: target.userSemester.id },
    include: { offering: { include: { module: true } }, classSessions: true, assessments: { where: { type: 'FINAL_EXAMINATION' } } }
  })
  const byCode = new Map(rows.map(row => [row.offering.module.code, row]))
  const modules = CURRENT_SEMESTER_SEED.modules.map(expected => {
    const row = byCode.get(expected.code)
    if (!row) throw new Error(`${expected.code} was not found during verification.`)
    if (row.indexNumber !== expected.indexNumber) throw new Error(`${expected.code} index number verification failed.`)
    if (row.offering.module.title !== expected.title || Number(row.offering.module.academicUnits) !== expected.academicUnits) throw new Error(`${expected.code} module detail verification failed.`)
    const sessions = new Map(row.classSessions.map(session => [classSessionIdentity(session), session]))
    if (sessions.size !== row.classSessions.length) throw new Error(`${expected.code} has duplicate session identities.`)
    for (const session of expected.sessions) {
      const stored = sessions.get(classSessionIdentity(session))
      const exact = stored
        && stored.venue === session.venue
        && stored.recurrence === session.recurrence
        && stored.deliveryMode === session.deliveryMode
        && JSON.stringify(stored.weekNumbers) === JSON.stringify(session.weekNumbers)
      if (!exact) throw new Error(`${expected.code} session verification failed.`)
    }
    if (row.assessments.length !== (expected.exam ? 1 : 0)) throw new Error(`${expected.code} exam verification failed.`)
    if (expected.exam) {
      const exam = row.assessments[0]
      if (exam.eventDate?.getTime() !== new Date(expected.exam.start).getTime() || exam.eventEndDate?.getTime() !== new Date(expected.exam.end).getTime() || exam.officialDeadline !== null) throw new Error(`${expected.code} exam time verification failed.`)
    }
    return { code: expected.code, sessions: expected.sessions.length, academicUnits: Number(row.offering.module.academicUnits), exams: row.assessments.length }
  })
  return {
    semester: `${target.academicTerm.academicYear} ${target.academicTerm.name}`,
    moduleCount: modules.length,
    academicUnits: modules.reduce((sum, module) => sum + module.academicUnits, 0),
    sessionCount: modules.reduce((sum, module) => sum + module.sessions, 0),
    examCount: modules.reduce((sum, module) => sum + module.exams, 0),
    modules
  }
}

try {
  const verification = await prisma.$transaction(async (transaction) => {
    const target = await resolveSeedTarget(transaction)
    if (target.academicTerm.semesterNumber !== CURRENT_SEMESTER_SEED.semesterNumber) await transaction.academicTerm.update({ where: { id: target.academicTerm.id }, data: { semesterNumber: CURRENT_SEMESTER_SEED.semesterNumber } })
    const seeded = []
    for (const module of CURRENT_SEMESTER_SEED.modules) seeded.push(await seedModule(transaction, target, module))
    return verifySeed(transaction, target, seeded)
  }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 })

  console.log(`Semester: ${verification.semester}`)
  console.log(`Modules: ${verification.moduleCount}`)
  console.log(`AU: ${verification.academicUnits}`)
  console.log(`Sessions: ${verification.sessionCount}`)
  console.log(`Exams: ${verification.examCount}`)
  for (const module of verification.modules) console.log(`${module.code}: ${module.sessions} session${module.sessions === 1 ? '' : 's'}`)
} finally {
  await prisma.$disconnect()
}
