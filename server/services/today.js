import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { recommendedTodayAction, todayActionCandidates } from '#shared/academic/today-prioritization'

const decimal = value => value === null || value === undefined ? null : Number(value)
const iso = value => value instanceof Date ? value.toISOString() : value

export async function getToday(userId, database = prisma, now = new Date()) {
  const semester = await database.userSemester.findFirst({
    where: { userId, isActive: true }, include: { academicTerm: true, moduleEnrolments: { where: { userId, status: 'ACTIVE' }, include: {
      offering: { include: { module: true } }, classSessions: true,
      assessments: { where: { status: { not: 'CANCELLED' } }, orderBy: [{ officialDeadline: 'asc' }, { eventDate: 'asc' }] },
      recurringCoursework: { where: { status: 'ACTIVE' }, include: { occurrences: { where: { status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'MISSED'] } }, orderBy: { sequenceNumber: 'asc' } } } }
    } } }
  })
  if (!semester) throw createError({ statusCode: 409, statusMessage: 'Select an active semester before opening Today.' })
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Singapore' }).toUpperCase()
  const taskRecords = await database.task.findMany({
    where: { userId, parentTaskId: null, status: { notIn: ['COMPLETED', 'CANCELLED'] }, OR: [{ moduleEnrolmentId: null }, { moduleEnrolment: { userSemesterId: semester.id } }] },
    include: { moduleEnrolment: { select: { offering: { select: { module: { select: { code: true } } } } } } },
    orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }]
  })
  const tasks = taskRecords.map(task => ({ ...task, moduleCode: task.moduleEnrolment?.offering.module.code || null, moduleEnrolment: undefined, dueAt: iso(task.dueAt) }))
  const courseworkHorizon = new Date(now); courseworkHorizon.setDate(courseworkHorizon.getDate() + 7)
  const coursework = semester.moduleEnrolments.flatMap(enrolment => enrolment.recurringCoursework.flatMap(requirement => requirement.occurrences.map(occurrence => ({ id: occurrence.id, requirementId: requirement.id, title: `${requirement.title}${occurrence.teachingWeek ? ` · Week ${occurrence.teachingWeek}` : ''}`, moduleCode: enrolment.offering.module.code, timingNote: occurrence.timingNote || requirement.timingNote, dueAt: iso(occurrence.officialDueAt), status: occurrence.status, verified: occurrence.gradeCentreChecked, completeBeforeClass: requirement.completeBeforeClass })))).filter(item => ['MISSED', 'SUBMITTED'].includes(item.status) || item.completeBeforeClass || (item.dueAt && new Date(item.dueAt) <= courseworkHorizon))
  const assessments = semester.moduleEnrolments.flatMap(enrolment => enrolment.assessments.map(assessment => ({ id: assessment.id, name: assessment.name, moduleCode: enrolment.offering.module.code, weight: decimal(assessment.weight), date: iso(assessment.officialDeadline || assessment.eventDate), status: assessment.status, estimatedMinutes: assessment.estimatedEffortMinutes }))).filter(item => item.date && new Date(item.date) >= now).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  const classes = semester.moduleEnrolments.flatMap(enrolment => enrolment.classSessions.filter(session => session.dayOfWeek === weekday).map(session => ({ id: session.id, moduleCode: enrolment.offering.module.code, moduleTitle: enrolment.offering.module.title, classType: session.classType, startMinutes: session.startMinutes, endMinutes: session.endMinutes, venue: session.venue }))).sort((a, b) => a.startMinutes - b.startMinutes)
  const input = { tasks, coursework, assessments }
  return { date: now.toISOString(), semester: `${semester.academicTerm.academicYear} · ${semester.academicTerm.name}`, recommendation: recommendedTodayAction(input, now), candidates: todayActionCandidates(input, now), tasks, coursework, assessments, classes }
}
