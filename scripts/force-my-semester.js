import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import { createJiti } from 'jiti'
import { CURRENT_SEMESTER_SEED, validateCurrentSemesterSeed } from './current-semester-seed-data.js'

const { PrismaClient } = await createJiti(import.meta.url).import('../server/generated/prisma/client.ts')

const TARGET_EMAIL = 'gavarasanasrisaisaranya@gmail.com'
const connectionString = process.env.DATABASE_URL

if (!connectionString) throw new Error('DATABASE_URL is required.')

validateCurrentSemesterSeed()
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

function normalizedAssessmentName(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

async function resolveTarget(database) {
  const user = await database.user.findUnique({ where: { email: TARGET_EMAIL } })
  if (!user) throw new Error(`User ${TARGET_EMAIL} does not exist.`)

  const academicProfile = await database.userAcademicProfile.findUnique({ where: { userId: user.id } })
  if (!academicProfile) throw new Error(`User ${TARGET_EMAIL} has no academic profile.`)

  const userSemester = await database.userSemester.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { updatedAt: 'desc' }
  })
  if (!userSemester) throw new Error(`User ${TARGET_EMAIL} has no active semester.`)

  return { user, academicProfile, userSemester }
}

async function upsertModule(database, target, expected) {
  return database.module.upsert({
    where: {
      universityId_code: {
        universityId: target.academicProfile.universityId,
        code: expected.code
      }
    },
    update: {
      title: expected.title,
      academicUnits: expected.academicUnits
    },
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
    where: {
      userId: target.user.id,
      userModuleEnrolmentId: enrolment.id,
      type: 'FINAL_EXAMINATION'
    },
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

async function upsertSemesterModule(database, target, expected) {
  const module = await upsertModule(database, target, expected)
  const offering = await database.moduleOffering.upsert({
    where: {
      moduleId_academicTermId_sectionLabel: {
        moduleId: module.id,
        academicTermId: target.userSemester.academicTermId,
        sectionLabel: 'DEFAULT'
      }
    },
    update: {},
    create: {
      moduleId: module.id,
      academicTermId: target.userSemester.academicTermId,
      sectionLabel: 'DEFAULT'
    }
  })
  const enrolment = await database.userModuleEnrolment.upsert({
    where: { userId_offeringId: { userId: target.user.id, offeringId: offering.id } },
    update: {
      userSemesterId: target.userSemester.id,
      indexNumber: expected.indexNumber,
      status: 'ACTIVE',
      registrationStatus: 'REGISTERED'
    },
    create: {
      userId: target.user.id,
      userSemesterId: target.userSemester.id,
      offeringId: offering.id,
      indexNumber: expected.indexNumber,
      status: 'ACTIVE',
      registrationStatus: 'REGISTERED'
    }
  })

  for (const session of expected.sessions) {
    await database.classSession.upsert({
      where: {
        userModuleEnrolmentId_classType_groupLabel_dayOfWeek_startMinutes_endMinutes: {
          userModuleEnrolmentId: enrolment.id,
          classType: session.classType,
          groupLabel: session.groupLabel,
          dayOfWeek: session.dayOfWeek,
          startMinutes: session.startMinutes,
          endMinutes: session.endMinutes
        }
      },
      update: {
        venue: session.venue,
        recurrence: session.recurrence,
        weekNumbers: session.weekNumbers,
        deliveryMode: session.deliveryMode,
        source: 'MANUAL'
      },
      create: { userModuleEnrolmentId: enrolment.id, ...session, source: 'MANUAL' }
    })
  }

  await upsertExam(database, target, enrolment, expected)
}

try {
  await prisma.$transaction(async (database) => {
    const target = await resolveTarget(database)
    for (const module of CURRENT_SEMESTER_SEED.modules) {
      await upsertSemesterModule(database, target, module)
    }
  }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 })

  console.log('Semester populated successfully')
  console.log('Modules: 6')
  console.log('AU: 16')
  console.log('Sessions: 9')
  console.log('Exams: 4')
} finally {
  await prisma.$disconnect()
}
