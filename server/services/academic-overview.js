import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { calculateGradeIntelligence } from '#shared/academic/grade-intelligence'

const DAY_MS = 86_400_000
const COMPLETE_WEIGHT_TOLERANCE = 0.01

const numberValue = value => value === null || value === undefined ? null : Number(value)
const dateValue = value => value instanceof Date ? value.toISOString() : value ?? null
const rounded = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100

function displayModuleTitle(value) {
  if (!value || value !== value.toUpperCase()) return value
  const minorWords = new Set(['AND', 'FOR', 'IN', 'OF', 'THE', 'TO', 'WITH'])
  return value.split(/\s+/).map((word, index) => {
    if (word === '&') return word
    if (index > 0 && minorWords.has(word)) return word.toLowerCase()
    return word.charAt(0) + word.slice(1).toLowerCase()
  }).join(' ')
}

function validWeight(value) {
  const number = numberValue(value)
  return number !== null && Number.isFinite(number) && number >= 0 && number <= 100
}

export function confirmedAssessmentDate(assessment) {
  return assessment.officialDeadline || assessment.eventDate || null
}

export function assessmentStructure(assessments) {
  const active = assessments.filter(item => item.status !== 'CANCELLED')
  const weights = active.filter(item => validWeight(item.weight)).map(item => Number(item.weight))
  const confirmedWeight = rounded(weights.reduce((total, value) => total + value, 0))
  const hasMissingWeight = weights.length !== active.length
  const complete = active.length > 0 && !hasMissingWeight && Math.abs(confirmedWeight - 100) < COMPLETE_WEIGHT_TOLERANCE
  return {
    assessmentCount: active.length,
    confirmedWeight,
    hasMissingWeight,
    complete,
    knownDeadlineCount: active.filter(item => confirmedAssessmentDate(item)).length
  }
}

export function readinessStatus(structure) {
  if (!structure.assessmentCount) return 'NO_ASSESSMENTS'
  if (!structure.complete) return 'INCOMPLETE_ASSESSMENT_STRUCTURE'
  if (structure.knownDeadlineCount < structure.assessmentCount) return 'MISSING_DATES'
  return 'READY'
}

function daysRemaining(value, now) {
  return Math.ceil((new Date(value).getTime() - now.getTime()) / DAY_MS)
}

function serializedAssessment(assessment) {
  return {
    id: assessment.id,
    name: assessment.name,
    type: assessment.type,
    weight: numberValue(assessment.weight),
    officialDeadline: dateValue(assessment.officialDeadline),
    eventDate: dateValue(assessment.eventDate),
    status: assessment.status,
    score: numberValue(assessment.score),
    maximumScore: numberValue(assessment.maximumScore),
    percentageScore: numberValue(assessment.percentageScore),
    weightedScore: numberValue(assessment.weightedScore)
  }
}

function moduleAction(enrolmentId, section = '') {
  return `/app/modules/${enrolmentId}${section}`
}

export function buildAcademicOverview(semester, now = new Date()) {
  const modules = semester.moduleEnrolments.map(enrolment => {
    const assessments = enrolment.assessments.map(serializedAssessment)
    const structure = assessmentStructure(assessments)
    const targetPercentage = numberValue(enrolment.targetPercentage)
    const grade = calculateGradeIntelligence(assessments, targetPercentage)

    return {
      enrolmentId: enrolment.id,
      code: enrolment.offering.module.code,
      title: displayModuleTitle(enrolment.offering.module.title),
      academicUnits: numberValue(enrolment.offering.module.academicUnits),
      colour: enrolment.colour,
      targetGrade: enrolment.targetGrade,
      targetPercentage,
      targetLabel: enrolment.targetLabel,
      assessmentCount: structure.assessmentCount,
      confirmedWeight: structure.confirmedWeight,
      knownDeadlineCount: structure.knownDeadlineCount,
      sessionCount: enrolment._count?.classSessions ?? 0,
      readiness: readinessStatus(structure),
      completeAssessmentStructure: structure.complete,
      assessments,
      reviewRequiredImports: enrolment.courseOutlineImports.map(item => ({
        id: item.id,
        label: item.originalFileName || item.sourceLabel || 'Course outline review',
        createdAt: dateValue(item.createdAt)
      })),
      grade: {
        targetPercentage: grade.targetPercentage,
        confirmedWeight: grade.confirmedWeight,
        gradedWeight: grade.gradedWeight,
        currentWeightedScore: grade.currentWeightedScore,
        remainingWeight: grade.remainingWeight,
        requiredAverage: grade.requiredAverage
      },
      to: moduleAction(enrolment.id)
    }
  })

  const attention = []
  const upcoming = []

  for (const module of modules) {
    if (!module.assessmentCount) {
      attention.push({
        id: `module-no-assessments:${module.enrolmentId}`,
        kind: 'NO_ASSESSMENTS',
        moduleCode: module.code,
        title: `${module.code} has no confirmed assessments`,
        description: 'Add assessments manually or review an existing course-outline import.',
        to: moduleAction(module.enrolmentId, '#assessments')
      })
    } else if (!module.completeAssessmentStructure) {
      attention.push({
        id: `module-incomplete-weights:${module.enrolmentId}`,
        kind: 'INCOMPLETE_ASSESSMENT_STRUCTURE',
        moduleCode: module.code,
        title: `${module.code} assessment structure is incomplete`,
        description: `Confirmed weights currently total ${module.confirmedWeight}%.`,
        to: moduleAction(module.enrolmentId, '#assessments')
      })
    }

    if (!module.targetGrade) {
      attention.push({
        id: `module-no-target:${module.enrolmentId}`,
        kind: 'NO_TARGET_GRADE',
        moduleCode: module.code,
        title: `${module.code} has no target grade`,
        description: 'Set a personal target grade in the module dossier.',
        to: moduleAction(module.enrolmentId)
      })
    }

    for (const assessment of module.assessments) {
      if (!validWeight(assessment.weight)) {
        attention.push({
          id: `assessment-no-weight:${assessment.id}`,
          kind: 'MISSING_WEIGHT',
          moduleCode: module.code,
          title: `${assessment.name} has no confirmed weight`,
          description: `${module.code} cannot have a complete assessment structure until this is confirmed.`,
          to: `/app/assessments/${assessment.id}`
        })
      }

      const confirmedDate = confirmedAssessmentDate(assessment)
      if (!confirmedDate) {
        attention.push({
          id: `assessment-no-date:${assessment.id}`,
          kind: 'MISSING_DATE',
          moduleCode: module.code,
          title: `${assessment.name} has no confirmed date`,
          description: 'Teaching-week references are not converted into calendar dates automatically.',
          to: `/app/assessments/${assessment.id}`
        })
      } else if (new Date(confirmedDate).getTime() >= now.getTime()) {
        upcoming.push({
          id: assessment.id,
          name: assessment.name,
          moduleCode: module.code,
          type: assessment.type,
          weight: assessment.weight,
          date: dateValue(confirmedDate),
          dateSource: assessment.officialDeadline ? 'OFFICIAL_DEADLINE' : 'EVENT_DATE',
          daysRemaining: daysRemaining(confirmedDate, now),
          to: `/app/assessments/${assessment.id}`
        })
      }
    }

    for (const importRecord of module.reviewRequiredImports) {
      attention.push({
        id: `outline-review:${importRecord.id}`,
        kind: 'REVIEW_REQUIRED_IMPORT',
        moduleCode: module.code,
        title: `${module.code} course-outline import needs review`,
        description: importRecord.label,
        to: `/app/course-outline-imports/${importRecord.id}`
      })
    }
  }

  upcoming.sort((left, right) => new Date(left.date) - new Date(right.date) || left.moduleCode.localeCompare(right.moduleCode) || left.name.localeCompare(right.name))

  const completeModuleCount = modules.filter(module => module.completeAssessmentStructure).length
  const totalAcademicUnits = rounded(modules.reduce((total, module) => total + (module.academicUnits ?? 0), 0))
  const totalConfirmedAssessments = modules.reduce((total, module) => total + module.assessmentCount, 0)

  return {
    activeSemester: {
      id: semester.id,
      academicTermId: semester.academicTermId,
      academicYear: semester.academicTerm.academicYear,
      name: semester.academicTerm.name,
      label: `${semester.academicTerm.academicYear} · ${semester.academicTerm.name}`
    },
    summary: {
      activeModuleCount: modules.length,
      totalAcademicUnits,
      totalConfirmedAssessments,
      completeAssessmentStructureCount: completeModuleCount,
      missingAssessmentInformationCount: modules.length - completeModuleCount
    },
    attention,
    upcomingAssessments: upcoming,
    modules: modules.map(({ assessments, reviewRequiredImports, completeAssessmentStructure, ...module }) => module),
    currentDate: now.toISOString()
  }
}

export async function getAcademicOverview(userId, database = prisma, now = new Date()) {
  const semester = await database.userSemester.findFirst({
    where: { userId, isActive: true },
    select: {
      id: true,
      academicTermId: true,
      academicTerm: { select: { academicYear: true, name: true } },
      moduleEnrolments: {
        where: { userId, status: 'ACTIVE' },
        orderBy: [{ offering: { module: { code: 'asc' } } }, { createdAt: 'asc' }],
        select: {
          id: true,
          targetGrade: true,
          targetPercentage: true,
          targetLabel: true,
          colour: true,
          offering: {
            select: {
              module: { select: { code: true, title: true, academicUnits: true } }
            }
          },
          assessments: {
            where: { userId, status: { not: 'CANCELLED' } },
            orderBy: [{ officialDeadline: 'asc' }, { eventDate: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              name: true,
              type: true,
              weight: true,
              officialDeadline: true,
              eventDate: true,
              status: true,
              score: true,
              maximumScore: true,
              percentageScore: true,
              weightedScore: true
            }
          },
          _count: { select: { classSessions: true } },
          courseOutlineImports: {
            where: { userId, status: 'REVIEW_REQUIRED' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, originalFileName: true, sourceLabel: true, createdAt: true }
          }
        }
      }
    }
  })

  if (!semester) throw createError({ statusCode: 409, statusMessage: 'Select an active semester before loading the academic overview.' })
  return buildAcademicOverview(semester, now)
}
