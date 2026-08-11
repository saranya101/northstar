import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))

import { DEFAULT_PREPARATION, derivePreparationReadiness, getPreparationGaps } from '../shared/academic/preparation'
import { updatePreparationSchema } from '../shared/schemas/preparation'
import { getPreparation, parseTeachingWeek, updatePreparation } from '../server/services/preparation'
import { getToday } from '../server/services/today'

const semester = {
  id: 'semester-1',
  academicTerm: {
    academicYear: '2026/2027', name: 'Semester 1',
    teachingStartDate: new Date('2026-08-10T00:00:00.000Z'), endDate: new Date('2026-11-15T00:00:00.000Z')
  }
}
const enrolment = { id: 'enrolment-1', userId: 'user-1', userSemesterId: 'semester-1', status: 'ACTIVE', offering: { module: { id: 'module-1', code: 'AB1201', title: 'Financial Management' } } }

function preparationDatabase({ owned = true, record = null } = {}) {
  const database = {
    userSemester: { findFirst: vi.fn().mockResolvedValue(semester) },
    userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(owned ? enrolment : null) },
    moduleWeekPreparation: {
      findFirst: vi.fn().mockResolvedValue(record),
      upsert: vi.fn(async ({ create, update }) => ({
        id: 'preparation-1', ...DEFAULT_PREPARATION, ...create, ...update,
        createdAt: new Date('2026-08-10T00:00:00.000Z'), updatedAt: new Date('2026-08-10T00:00:00.000Z')
      }))
    }
  }
  database.$transaction = vi.fn(callback => callback(database))
  return database
}

describe('class preparation readiness', () => {
  it('derives readiness without a score', () => {
    expect(derivePreparationReadiness(null)).toBe('NOT_STARTED')
    expect(derivePreparationReadiness({ ...DEFAULT_PREPARATION, materialStatus: 'DONE' })).toBe('IN_PROGRESS')
    expect(derivePreparationReadiness({ materialStatus: 'DONE', notesStatus: 'DONE', requiredWorkStatus: 'DONE', practiceStatus: 'DONE' })).toBe('READY')
  })

  it('treats NOT_REQUIRED as complete and questions as non-blocking', () => {
    expect(derivePreparationReadiness({ materialStatus: 'NOT_REQUIRED', notesStatus: 'DONE', requiredWorkStatus: 'NOT_REQUIRED', practiceStatus: 'DONE', questions: 'Ask why' })).toBe('READY')
    expect(derivePreparationReadiness({ materialStatus: 'NOT_REQUIRED', notesStatus: 'NOT_REQUIRED', requiredWorkStatus: 'NOT_REQUIRED', practiceStatus: 'NOT_REQUIRED' })).toBe('READY')
  })

  it('returns factual preparation gaps for future prioritisation', () => {
    expect(getPreparationGaps({
      moduleCode: 'AB1201', teachingWeek: 2, classStart: '2026-08-18T13:30:00',
      preparation: { materialStatus: 'DONE', notesStatus: 'DONE', requiredWorkStatus: 'NOT_REQUIRED', practiceStatus: 'IN_PROGRESS' }
    })).toEqual({ moduleCode: 'AB1201', teachingWeek: 2, classStart: '2026-08-18T13:30:00', missing: ['PRACTICE'], readiness: 'IN_PROGRESS' })
  })
})

describe('class preparation persistence', () => {
  it('returns a virtual NOT_STARTED record on first access without writing', async () => {
    const database = preparationDatabase()
    const result = await getPreparation('user-1', 'enrolment-1', '2', database)
    expect(result).toMatchObject({ id: null, teachingWeek: 2, readiness: 'NOT_STARTED', persisted: false })
    expect(database.moduleWeekPreparation.upsert).not.toHaveBeenCalled()
  })

  it('supports validated partial updates using the enrolment-week unique key', async () => {
    const database = preparationDatabase()
    const input = updatePreparationSchema.parse({ materialStatus: 'DONE' })
    const result = await updatePreparation('user-1', 'enrolment-1', 2, input, database)
    expect(result).toMatchObject({ materialStatus: 'DONE', notesStatus: 'NOT_STARTED', readiness: 'IN_PROGRESS' })
    expect(database.moduleWeekPreparation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userModuleEnrolmentId_teachingWeek: { userModuleEnrolmentId: 'enrolment-1', teachingWeek: 2 } },
      update: { materialStatus: 'DONE' }
    }))
  })

  it('owner-isolates reads and updates', async () => {
    const database = preparationDatabase({ owned: false })
    await expect(getPreparation('other-user', 'enrolment-1', 2, database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(updatePreparation('other-user', 'enrolment-1', 2, { notesStatus: 'DONE' }, database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.moduleWeekPreparation.upsert).not.toHaveBeenCalled()
  })

  it('rejects invalid weeks and prevents duplicate enrolment-week rows in the schema', () => {
    expect(() => parseTeachingWeek(0)).toThrow(/1 to 52/)
    expect(() => parseTeachingWeek(53)).toThrow(/1 to 52/)
    expect(() => parseTeachingWeek('two')).toThrow(/1 to 52/)
    const schema = readFileSync(join(new URL('..', import.meta.url).pathname, 'prisma/schema.prisma'), 'utf8')
    expect(schema).toMatch(/model ModuleWeekPreparation[\s\S]*@@unique\(\[userModuleEnrolmentId, teachingWeek\]\)/)
  })
})

describe('Today upcoming class preparation', () => {
  it('uses canonical timetable occurrences without mutating sessions', async () => {
    const classSession = {
      id: 'session-1', classType: 'SEMINAR', groupLabel: '11', dayOfWeek: 'TUESDAY',
      startMinutes: 810, endMinutes: 980, venue: 'ESR4', recurrence: 'WEEKLY', weekNumbers: [],
      deliveryMode: 'IN_PERSON', source: 'MANUAL'
    }
    const database = {
      userSemester: { findFirst: vi.fn().mockResolvedValue({
        ...semester,
        moduleEnrolments: [{
          ...enrolment, classSessions: [classSession], assessments: [], recurringCoursework: [],
          weekPreparations: [{ teachingWeek: 1, materialStatus: 'DONE', notesStatus: 'DONE', requiredWorkStatus: 'NOT_REQUIRED', practiceStatus: 'IN_PROGRESS', questions: null }]
        }]
      }) },
      task: { findMany: vi.fn().mockResolvedValue([]) }
    }
    const result = await getToday('user-1', database, new Date('2026-08-10T04:00:00.000Z'))
    expect(result.upcomingClasses).toEqual([expect.objectContaining({
      moduleCode: 'AB1201', teachingWeek: 1, start: '2026-08-11T13:30:00', venue: 'ESR4',
      preparation: expect.objectContaining({ readiness: 'IN_PROGRESS' })
    })])
    expect(database.classSession).toBeUndefined()
  })

  it('exposes dense preparation entry points on Today and the module dossier', () => {
    const root = new URL('..', import.meta.url).pathname
    const todayPage = readFileSync(join(root, 'app/pages/app/index.vue'), 'utf8')
    const dossierPage = readFileSync(join(root, 'app/pages/app/modules/[id].vue'), 'utf8')
    const panel = readFileSync(join(root, 'app/components/academic/PreparationPanel.vue'), 'utf8')
    expect(todayPage).toMatch(/Upcoming classes/)
    expect(todayPage).toMatch(/item\.preparationLink/)
    expect(dossierPage).toMatch(/AcademicPreparationPanel/)
    expect(panel).toMatch(/Mark done/)
    expect(panel).not.toMatch(/percentage|progress-ring|streak/i)
  })
})
