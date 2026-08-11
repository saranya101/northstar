import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { recommendedTodayAction, todayActionCandidates } from '#shared/academic/today-prioritization'
import { getPreparationGaps, normalizePreparation } from '#shared/academic/preparation'
import { buildTimetableEvents, dateKey, dateTimeKey } from '#shared/calendar/events'

const decimal = value => value === null || value === undefined ? null : Number(value)
const iso = value => value instanceof Date ? value.toISOString() : value

export async function getToday(userId, database = prisma, now = new Date()) {
  const semester = await database.userSemester.findFirst({
    where: { userId, isActive: true }, include: { academicTerm: true, moduleEnrolments: { where: { userId, status: 'ACTIVE' }, include: {
      offering: { include: { module: true } }, classSessions: true,
      weekPreparations: { where: { userId } },
      assessments: { where: { status: { not: 'CANCELLED' } }, orderBy: [{ officialDeadline: 'asc' }, { eventDate: 'asc' }] },
      recurringCoursework: { where: { status: 'ACTIVE' }, include: { occurrences: { where: { status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'MISSED'] } }, orderBy: { sequenceNumber: 'asc' } } } }
    } } }
  })
  if (!semester) throw createError({ statusCode: 409, statusMessage: 'Select an active semester before opening Today.' })
  const taskRecords = await database.task.findMany({
    where: { userId, parentTaskId: null, status: { notIn: ['COMPLETED', 'CANCELLED'] }, OR: [{ moduleEnrolmentId: null }, { moduleEnrolment: { userSemesterId: semester.id } }] },
    include: { moduleEnrolment: { select: { offering: { select: { module: { select: { code: true } } } } } } },
    orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }]
  })
  const tasks = taskRecords.map(task => ({ ...task, moduleCode: task.moduleEnrolment?.offering.module.code || null, moduleEnrolment: undefined, dueAt: iso(task.dueAt) }))
  const courseworkHorizon = new Date(now); courseworkHorizon.setDate(courseworkHorizon.getDate() + 7)
  const coursework = semester.moduleEnrolments.flatMap(enrolment => enrolment.recurringCoursework.flatMap(requirement => requirement.occurrences.map(occurrence => ({ id: occurrence.id, requirementId: requirement.id, title: `${requirement.title}${occurrence.teachingWeek ? ` · Week ${occurrence.teachingWeek}` : ''}`, moduleCode: enrolment.offering.module.code, timingNote: occurrence.timingNote || requirement.timingNote, dueAt: iso(occurrence.officialDueAt), status: occurrence.status, verified: occurrence.gradeCentreChecked, completeBeforeClass: requirement.completeBeforeClass })))).filter(item => ['MISSED', 'SUBMITTED'].includes(item.status) || item.completeBeforeClass || (item.dueAt && new Date(item.dueAt) <= courseworkHorizon))
  const assessments = semester.moduleEnrolments.flatMap(enrolment => enrolment.assessments.map(assessment => ({ id: assessment.id, name: assessment.name, moduleCode: enrolment.offering.module.code, weight: decimal(assessment.weight), date: iso(assessment.officialDeadline || assessment.eventDate), status: assessment.status, estimatedMinutes: assessment.estimatedEffortMinutes }))).filter(item => item.date && new Date(item.date) >= now).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  const horizon = new Date(now.getTime() + 72 * 60 * 60 * 1000)
  const startKey = dateTimeKey(now)
  const endKey = dateTimeKey(horizon)
  const timetableEvents = buildTimetableEvents({
    sessions: semester.moduleEnrolments.flatMap(enrolment => enrolment.classSessions.map(session => ({
      ...session,
      enrolmentId: enrolment.id,
      module: { code: enrolment.offering.module.code, title: enrolment.offering.module.title }
    }))),
    activeSemester: { teachingStartDate: semester.academicTerm.teachingStartDate, teachingEndDate: semester.academicTerm.endDate },
    rangeStart: dateKey(now),
    rangeEnd: dateKey(horizon)
  })
  const todayKey = dateKey(now)
  const classes = timetableEvents.filter(event => event.dateKey === todayKey).map(event => ({
    id: event.id,
    moduleCode: event.moduleCode,
    moduleTitle: event.moduleTitle,
    classType: event.classType,
    startMinutes: event.startMinutes,
    endMinutes: event.endMinutes,
    venue: event.location
  }))
  const enrolments = new Map(semester.moduleEnrolments.map(enrolment => [enrolment.id, enrolment]))
  const upcomingClasses = timetableEvents.filter(event => event.start >= startKey && event.start <= endKey).map(event => {
    const enrolment = enrolments.get(event.moduleId)
    const preparation = normalizePreparation(enrolment?.weekPreparations.find(item => item.teachingWeek === event.weekNumber))
    return {
      id: event.id,
      enrolmentId: event.moduleId,
      moduleCode: event.moduleCode,
      moduleTitle: event.moduleTitle,
      classType: event.title.replace(`${event.moduleCode} `, ''),
      start: event.start,
      end: event.end,
      venue: event.location,
      teachingWeek: event.weekNumber,
      preparation: { ...preparation, readiness: getPreparationGaps({ preparation, moduleCode: event.moduleCode, teachingWeek: event.weekNumber, classStart: event.start }).readiness },
      preparationLink: `/app/modules/${event.moduleId}?week=${event.weekNumber}#preparation`
    }
  })
  const input = { tasks, coursework, assessments }
  return { date: now.toISOString(), semester: `${semester.academicTerm.academicYear} · ${semester.academicTerm.name}`, recommendation: recommendedTodayAction(input, now), candidates: todayActionCandidates(input, now), tasks, coursework, assessments, classes, upcomingClasses }
}
