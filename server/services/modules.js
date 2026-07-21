import { createError } from 'h3'
import { prisma } from '../utils/prisma'

function normalizeModuleCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value
}

function normalizeSectionLabel(value) {
  const section = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return section || 'DEFAULT'
}

const offeringInclude = {
  module: true,
  academicTerm: true,
  instructorAssignments: {
    include: { instructor: true },
    orderBy: { createdAt: 'asc' }
  }
}

function domainError(statusCode, statusMessage) {
  return createError({ statusCode, statusMessage })
}

async function runModuleTransaction(database, operation) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(operation, {
        isolationLevel: 'Serializable',
        maxWait: 10_000,
        timeout: 20_000
      })
    } catch (error) {
      if (attempt === 0 && ['P2028', 'P2034'].includes(error?.code)) continue
      throw error
    }
  }
}

function decimalValue(value) {
  return value === null || value === undefined ? null : Number(value)
}

function dateValue(value) {
  return value instanceof Date ? value.toISOString() : value ?? null
}

function instructorSummary(assignment) {
  return {
    id: assignment.instructor.id,
    fullName: assignment.instructor.fullName,
    title: assignment.instructor.title,
    officialEmail: assignment.instructor.officialEmail,
    officialProfileUrl: assignment.instructor.officialProfileUrl,
    role: assignment.role,
    sourceStatus: assignment.instructor.sourceStatus,
    lastVerifiedAt: dateValue(assignment.instructor.lastVerifiedAt)
  }
}

export function serializeEnrolment(enrolment) {
  const offering = enrolment.offering
  return {
    enrolmentId: enrolment.id,
    moduleId: offering.module.id,
    moduleOfferingId: offering.id,
    code: offering.module.code,
    title: offering.module.title,
    description: offering.module.description,
    academicUnits: decimalValue(offering.module.academicUnits),
    sectionLabel: offering.sectionLabel,
    targetGrade: enrolment.targetGrade,
    colour: enrolment.colour,
    status: enrolment.status,
    instructors: offering.instructorAssignments.map(instructorSummary),
    sourceStatus: offering.module.sourceStatus,
    lastVerifiedAt: dateValue(offering.module.lastVerifiedAt),
    createdAt: dateValue(enrolment.createdAt),
    updatedAt: dateValue(enrolment.updatedAt)
  }
}

export async function requireModuleContext(userId, database = prisma) {
  const [academicProfile, activeSemester] = await Promise.all([
    database.userAcademicProfile.findUnique({
      where: { userId },
      include: { university: true, school: true, programme: true }
    }),
    database.userSemester.findFirst({
      where: { userId, isActive: true },
      include: { academicTerm: true }
    })
  ])

  if (!academicProfile) throw domainError(409, 'Complete your academic profile before managing modules.')
  if (!activeSemester) throw domainError(409, 'Select an active semester before managing modules.')
  if (activeSemester.academicTerm.universityId !== academicProfile.universityId) {
    throw domainError(403, 'Your active semester does not belong to your university.')
  }

  return { academicProfile, activeSemester }
}

export async function listModules(userId, status = 'ACTIVE', database = prisma) {
  const { academicProfile, activeSemester } = await requireModuleContext(userId, database)
  const enrolments = await database.userModuleEnrolment.findMany({
    where: { userId, userSemesterId: activeSemester.id, status },
    include: { offering: { include: offeringInclude } },
    orderBy: [{ offering: { module: { code: 'asc' } } }, { createdAt: 'asc' }]
  })
  const activeCount = status === 'ACTIVE'
    ? enrolments.length
    : await database.userModuleEnrolment.count({ where: { userId, userSemesterId: activeSemester.id, status: 'ACTIVE' } })

  return {
    semester: {
      id: activeSemester.id,
      academicTermId: activeSemester.academicTermId,
      academicYear: activeSemester.academicTerm.academicYear,
      name: activeSemester.academicTerm.name,
      label: `${activeSemester.academicTerm.academicYear} · ${activeSemester.academicTerm.name}`,
      university: academicProfile.university.name
    },
    modules: enrolments.map(serializeEnrolment),
    activeCount
  }
}

export async function searchModules(userId, query, database = prisma) {
  const { academicProfile, activeSemester } = await requireModuleContext(userId, database)
  const normalized = normalizeModuleCode(query)
  const modules = await database.module.findMany({
    where: {
      universityId: academicProfile.universityId,
      OR: [
        { code: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      code: true,
      title: true,
      sourceStatus: true,
      offerings: {
        where: { academicTermId: activeSemester.academicTermId },
        select: { enrolments: { where: { userId }, select: { id: true } } }
      }
    },
    take: 20
  })

  return {
    query,
    results: modules
      .sort((left, right) => {
        const leftCode = left.code.toUpperCase()
        const rightCode = right.code.toUpperCase()
        const rank = code => code === normalized ? 0 : code.startsWith(normalized) ? 1 : 2
        return rank(leftCode) - rank(rightCode) || leftCode.localeCompare(rightCode)
      })
      .slice(0, 20)
      .map(module => ({
        id: module.id,
        code: module.code,
        title: module.title,
        sourceStatus: module.sourceStatus,
        alreadyEnrolled: module.offerings.some(offering => offering.enrolments.length > 0)
      }))
  }
}

async function findOrCreateInstructor(transaction, universityId, input) {
  const officialProfileUrl = input.officialProfileUrl || input.lecturerProfileUrl
  const fullName = input.fullName || input.lecturerName
  let instructor = officialProfileUrl
    ? await transaction.instructor.findFirst({ where: { universityId, officialProfileUrl } })
    : null

  if (!instructor) {
    instructor = await transaction.instructor.findFirst({
      where: { universityId, fullName: { equals: fullName, mode: 'insensitive' } }
    })
  }

  if (instructor) return instructor

  return transaction.instructor.create({
    data: {
      universityId,
      fullName,
      title: input.title || input.lecturerTitle,
      officialEmail: input.officialEmail || input.lecturerEmail,
      officialProfileUrl,
      sourceStatus: 'USER_ENTERED'
    }
  })
}

async function attachInstructor(transaction, offeringId, universityId, input, rejectDuplicate = false) {
  const instructor = await findOrCreateInstructor(transaction, universityId, input)
  const role = input.role || input.lecturerRole
  const existing = await transaction.instructorAssignment.findUnique({
    where: { offeringId_instructorId_role: { offeringId, instructorId: instructor.id, role } }
  })
  if (existing && rejectDuplicate) throw domainError(409, 'That instructor already has this role for the module.')
  if (!existing) {
    await transaction.instructorAssignment.create({ data: { offeringId, instructorId: instructor.id, role } })
  }
  return instructor
}

async function createEnrolment(transaction, userId, activeSemester, offering, input) {
  const duplicate = await transaction.userModuleEnrolment.findUnique({
    where: { userId_offeringId: { userId, offeringId: offering.id } }
  })
  if (duplicate) throw domainError(409, 'You are already enrolled in this module offering.')

  return transaction.userModuleEnrolment.create({
    data: {
      userId,
      userSemesterId: activeSemester.id,
      offeringId: offering.id,
      targetGrade: input.targetGrade,
      colour: input.colour
    },
    include: { offering: { include: offeringInclude } }
  })
}

export async function createManualModule(userId, input, database = prisma) {
  return runModuleTransaction(database, async (transaction) => {
    const { academicProfile, activeSemester } = await requireModuleContext(userId, transaction)
    const code = normalizeModuleCode(input.code)
    let module = await transaction.module.findUnique({
      where: { universityId_code: { universityId: academicProfile.universityId, code } }
    })

    if (!module) {
      module = await transaction.module.create({
        data: {
          universityId: academicProfile.universityId,
          schoolId: academicProfile.schoolId,
          code,
          title: input.title,
          description: input.description,
          academicUnits: input.academicUnits,
          sourceStatus: 'USER_ENTERED'
        }
      })
    } else if (!module.sourceStatus.startsWith('OFFICIAL_')) {
      const safeUpdates = {}
      if (!module.description && input.description) safeUpdates.description = input.description
      if (module.academicUnits === null && input.academicUnits !== undefined) safeUpdates.academicUnits = input.academicUnits
      if (!module.schoolId) safeUpdates.schoolId = academicProfile.schoolId
      if (Object.keys(safeUpdates).length) {
        module = await transaction.module.update({ where: { id: module.id }, data: safeUpdates })
      }
    }

    const sectionLabel = normalizeSectionLabel(input.sectionLabel)
    const offering = await transaction.moduleOffering.upsert({
      where: { moduleId_academicTermId_sectionLabel: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel } },
      update: {},
      create: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel }
    })

    if (input.lecturerName) {
      await attachInstructor(transaction, offering.id, academicProfile.universityId, input)
    }
    const enrolment = await createEnrolment(transaction, userId, activeSemester, offering, input)
    return serializeEnrolment(enrolment)
  })
}

export async function enrolExistingModule(userId, input, database = prisma) {
  return runModuleTransaction(database, async (transaction) => {
    const { academicProfile, activeSemester } = await requireModuleContext(userId, transaction)
    const module = await transaction.module.findUnique({ where: { id: input.moduleId } })
    if (!module) throw domainError(404, 'Module not found.')
    if (module.universityId !== academicProfile.universityId) throw domainError(403, 'That module belongs to another university.')

    const sectionLabel = normalizeSectionLabel(input.sectionLabel)
    const offering = await transaction.moduleOffering.upsert({
      where: { moduleId_academicTermId_sectionLabel: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel } },
      update: {},
      create: { moduleId: module.id, academicTermId: activeSemester.academicTermId, sectionLabel }
    })
    return serializeEnrolment(await createEnrolment(transaction, userId, activeSemester, offering, input))
  })
}

export async function getModuleDossier(userId, enrolmentId, database = prisma) {
  const enrolment = await database.userModuleEnrolment.findFirst({
    where: { id: enrolmentId, userId },
    include: { offering: { include: offeringInclude }, classSessions: { orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }] } }
  })
  if (!enrolment) throw domainError(404, 'Module enrolment not found.')
  const { offering } = enrolment
  return {
    module: {
      id: offering.module.id,
      code: offering.module.code,
      title: offering.module.title,
      description: offering.module.description,
      academicUnits: decimalValue(offering.module.academicUnits),
      level: offering.module.level,
      gradingBasis: offering.module.gradingBasis,
      officialUrl: offering.module.officialUrl,
      sourceStatus: offering.module.sourceStatus,
      lastVerifiedAt: dateValue(offering.module.lastVerifiedAt),
      verificationStatus: offering.module.verificationStatus,
      enrichmentProvenance: offering.module.enrichmentProvenance
    },
    offering: {
      id: offering.id,
      academicTerm: {
        id: offering.academicTerm.id,
        academicYear: offering.academicTerm.academicYear,
        name: offering.academicTerm.name
      },
      sectionLabel: offering.sectionLabel,
      gradingType: offering.gradingType,
      syllabusUrl: offering.syllabusUrl,
      courseOutlineFileUrl: offering.courseOutlineFileUrl,
      assessmentInformation: offering.assessmentInformation,
      notes: offering.notes
    },
    instructors: offering.instructorAssignments.map(instructorSummary),
    enrolment: {
      id: enrolment.id,
      targetGrade: enrolment.targetGrade,
      colour: enrolment.colour,
      personalNotes: enrolment.personalNotes,
      status: enrolment.status,
      indexNumber: enrolment.indexNumber,
      courseType: enrolment.courseType,
      registrationStatus: enrolment.registrationStatus,
      createdAt: dateValue(enrolment.createdAt),
      updatedAt: dateValue(enrolment.updatedAt)
    },
    classSessions: enrolment.classSessions.map(session => ({ ...session, confidence: decimalValue(session.confidence), createdAt: dateValue(session.createdAt), updatedAt: dateValue(session.updatedAt) }))
  }
}

export async function updateModuleEnrolment(userId, enrolmentId, input, database = prisma) {
  const existing = await database.userModuleEnrolment.findFirst({ where: { id: enrolmentId, userId }, select: { id: true } })
  if (!existing) throw domainError(404, 'Module enrolment not found.')
  const enrolment = await database.userModuleEnrolment.update({
    where: { id: enrolmentId },
    data: input,
    include: { offering: { include: offeringInclude } }
  })
  return serializeEnrolment(enrolment)
}

export async function closeModuleEnrolment(userId, enrolmentId, mode = 'drop', database = prisma) {
  return updateModuleEnrolment(userId, enrolmentId, { status: mode === 'archive' ? 'ARCHIVED' : 'DROPPED' }, database)
}

export async function addModuleInstructor(userId, enrolmentId, input, database = prisma) {
  return runModuleTransaction(database, async (transaction) => {
    const enrolment = await transaction.userModuleEnrolment.findFirst({
      where: { id: enrolmentId, userId },
      include: { offering: { include: { module: true } } }
    })
    if (!enrolment) throw domainError(404, 'Module enrolment not found.')
    await attachInstructor(transaction, enrolment.offeringId, enrolment.offering.module.universityId, input, true)
    const assignments = await transaction.instructorAssignment.findMany({
      where: { offeringId: enrolment.offeringId },
      include: { instructor: true },
      orderBy: { createdAt: 'asc' }
    })
    return { instructors: assignments.map(instructorSummary) }
  })
}
