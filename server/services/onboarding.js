import { createError } from 'h3'
import { prisma } from '../utils/prisma'

const academicProfileInclude = {
  university: true,
  school: true,
  programme: true
}

const semesterInclude = { academicTerm: true }

export function hasRequiredOnboardingRecords({ profile, academicProfile, activeSemester, studyPreference }) {
  return Boolean(profile && academicProfile && activeSemester && studyPreference)
}

export function validateAcademicRelationships({ school, programme }, selection) {
  if (!school || school.universityId !== selection.universityId) {
    throw createError({ statusCode: 400, statusMessage: 'The selected school does not belong to that university.' })
  }

  if (!programme || programme.schoolId !== selection.schoolId) {
    throw createError({ statusCode: 400, statusMessage: 'The selected programme does not belong to that school.' })
  }
}

async function advanceOnboardingStep(database, userId, nextStep) {
  await database.profile.upsert({
    where: { userId },
    update: {},
    create: { userId, onboardingStep: nextStep }
  })
  await database.profile.updateMany({
    where: { userId, onboardingStep: { lt: nextStep }, onboardingCompleted: false },
    data: { onboardingStep: nextStep }
  })
}

export async function getOnboardingState(userId, database = prisma) {
  const [profile, academicProfile, activeSemester, studyPreference, universities] = await Promise.all([
    database.profile.findUnique({ where: { userId } }),
    database.userAcademicProfile.findUnique({ where: { userId }, include: academicProfileInclude }),
    database.userSemester.findFirst({ where: { userId, isActive: true }, include: semesterInclude }),
    database.studyPreference.findUnique({ where: { userId } }),
    database.university.findMany({
      orderBy: { name: 'asc' },
      include: {
        schools: { orderBy: { name: 'asc' }, include: { programmes: { orderBy: { name: 'asc' } } } },
        academicTerms: { where: { semesterNumber: { not: null } }, orderBy: { startDate: 'desc' } }
      }
    })
  ])

  return {
    onboardingStep: profile?.onboardingStep ?? 1,
    onboardingCompleted: profile?.onboardingCompleted ?? false,
    profile,
    academicProfile,
    semester: activeSemester ? {
      ...activeSemester,
      targetSemesterGpa: activeSemester.targetSemesterGpa === null ? null : Number(activeSemester.targetSemesterGpa),
      currentCumulativeGpa: activeSemester.currentCumulativeGpa === null ? null : Number(activeSemester.currentCumulativeGpa)
    } : null,
    studyPreference,
    universities
  }
}

export async function saveProfile(userId, input, database = prisma) {
  return database.$transaction(async (transaction) => {
    const profile = await transaction.profile.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input, onboardingStep: 2 }
    })
    await advanceOnboardingStep(transaction, userId, 2)
    return profile
  })
}

export async function saveAcademicProfile(userId, input, database = prisma) {
  return database.$transaction(async (transaction) => {
    const [university, school, programme] = await Promise.all([
      transaction.university.findUnique({ where: { id: input.universityId }, select: { id: true } }),
      transaction.school.findUnique({ where: { id: input.schoolId }, select: { universityId: true } }),
      transaction.programme.findUnique({ where: { id: input.programmeId }, select: { schoolId: true } })
    ])

    if (!university) {
      throw createError({ statusCode: 400, statusMessage: 'Select a valid university.' })
    }
    validateAcademicRelationships({ school, programme }, input)

    const record = await transaction.userAcademicProfile.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
      include: academicProfileInclude
    })
    await advanceOnboardingStep(transaction, userId, 3)
    return record
  })
}

export async function saveSemester(userId, input, database = prisma) {
  return database.$transaction(async (transaction) => {
    const academicProfile = await transaction.userAcademicProfile.findUnique({
      where: { userId },
      select: { universityId: true }
    })
    if (!academicProfile) {
      throw createError({ statusCode: 409, statusMessage: 'Complete your academic profile first.' })
    }

    let academicTerm
    if (input.academicTermId) {
      academicTerm = await transaction.academicTerm.findFirst({
        where: { id: input.academicTermId, universityId: academicProfile.universityId }
      })
      if (!academicTerm) {
        throw createError({ statusCode: 400, statusMessage: 'Select a valid academic term.' })
      }
    } else {
      academicTerm = await transaction.academicTerm.upsert({
        where: {
          universityId_academicYear_name: {
            universityId: academicProfile.universityId,
            academicYear: input.customTerm.academicYear,
            name: input.customTerm.name
          }
        },
        update: {
          startDate: input.customTerm.startDate,
          endDate: input.customTerm.endDate
        },
        create: { universityId: academicProfile.universityId, ...input.customTerm }
      })
    }

    await transaction.userSemester.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
    const semester = await transaction.userSemester.upsert({
      where: { userId_academicTermId: { userId, academicTermId: academicTerm.id } },
      update: {
        targetSemesterGpa: input.targetSemesterGpa,
        currentCumulativeGpa: input.currentCumulativeGpa ?? null,
        isActive: true
      },
      create: {
        userId,
        academicTermId: academicTerm.id,
        targetSemesterGpa: input.targetSemesterGpa,
        currentCumulativeGpa: input.currentCumulativeGpa ?? null,
        isActive: true
      },
      include: semesterInclude
    })
    await advanceOnboardingStep(transaction, userId, 4)
    return semester
  }, { isolationLevel: 'Serializable' })
}

export async function saveStudyPreference(userId, input, database = prisma) {
  return database.$transaction(async (transaction) => {
    const preference = await transaction.studyPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input }
    })
    await advanceOnboardingStep(transaction, userId, 5)
    return preference
  })
}

export async function completeOnboarding(userId, database = prisma) {
  return database.$transaction(async (transaction) => {
    const [profile, academicProfile, activeSemester, studyPreference] = await Promise.all([
      transaction.profile.findUnique({ where: { userId } }),
      transaction.userAcademicProfile.findUnique({ where: { userId } }),
      transaction.userSemester.findFirst({ where: { userId, isActive: true } }),
      transaction.studyPreference.findUnique({ where: { userId } })
    ])

    if (!hasRequiredOnboardingRecords({ profile, academicProfile, activeSemester, studyPreference })) {
      throw createError({ statusCode: 409, statusMessage: 'Complete every onboarding step before continuing.' })
    }

    await transaction.profile.update({
      where: { userId },
      data: { onboardingCompleted: true, onboardingStep: 6 }
    })
    return { redirectTo: '/app' }
  })
}
