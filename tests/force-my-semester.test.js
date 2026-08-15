import { describe, expect, it, vi } from 'vitest'

import { CURRENT_SEMESTER_SEED, currentSemesterSeedSummary } from '../scripts/current-semester-seed-data.js'
import {
  academicCalendarDiagnosticLines,
  AUTHORITATIVE_RECESS_END,
  AUTHORITATIVE_RECESS_START,
  AUTHORITATIVE_TEACHING_START,
  setAuthoritativeAcademicCalendar,
  synchronizeCurrentSemester,
  teachingWeekMappingStatus
} from '../scripts/force-my-semester-logic.js'
import { dateKey } from '../shared/calendar/events.js'

const target = {
  user: { id: 'dev-user' },
  academicProfile: { universityId: 'university-1', schoolId: 'school-1' },
  userSemester: {
    id: 'active-semester', academicTermId: 'term-1',
    academicTerm: {
      teachingStartDate: new Date('2026-08-10T00:00:00.000Z'),
      recessStartDate: new Date('2026-09-28T00:00:00.000Z'),
      recessEndDate: new Date('2026-10-02T00:00:00.000Z'),
      endDate: new Date('2026-11-30T00:00:00.000Z')
    }
  }
}

function fakeDatabase() {
  const rows = [
    { id: 'unrelated-user', userModuleEnrolmentId: 'other-user-enrolment' },
    { id: 'unrelated-semester', userModuleEnrolmentId: 'other-semester-enrolment' },
    { id: 'stale-ab0403-other', userModuleEnrolmentId: 'enrolment-offering-module-AB0403', classType: 'OTHER', dayOfWeek: 'TUESDAY' },
    { id: 'stale-he5091-tuesday', userModuleEnrolmentId: 'enrolment-offering-module-HE5091', classType: 'OTHER', dayOfWeek: 'TUESDAY' }
  ]
  const exams = new Map()
  const database = {
    module: { upsert: vi.fn(({ where }) => Promise.resolve({ id: `module-${where.universityId_code.code}` })) },
    moduleOffering: { upsert: vi.fn(({ where }) => Promise.resolve({ id: `offering-${where.moduleId_academicTermId_sectionLabel.moduleId}` })) },
    userModuleEnrolment: { upsert: vi.fn(({ where }) => Promise.resolve({ id: `enrolment-${where.userId_offeringId.offeringId}` })) },
    assessment: {
      findFirst: vi.fn(({ where }) => Promise.resolve(exams.get(where.userModuleEnrolmentId) || null)),
      create: vi.fn(({ data }) => {
        const exam = { id: `exam-${data.userModuleEnrolmentId}`, ...data }
        exams.set(data.userModuleEnrolmentId, exam)
        return Promise.resolve(exam)
      }),
      update: vi.fn(({ where, data }) => {
        const exam = { id: where.id, ...data }
        exams.set(data.userModuleEnrolmentId, exam)
        return Promise.resolve(exam)
      })
    },
    classSession: {
      deleteMany: vi.fn(({ where }) => {
        const ids = new Set(where.userModuleEnrolmentId.in)
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (ids.has(rows[index].userModuleEnrolmentId)) rows.splice(index, 1)
        }
        return Promise.resolve({ count: 0 })
      }),
      create: vi.fn(({ data }) => {
        const row = { id: `session-${rows.length}`, ...data }
        rows.push(row)
        return Promise.resolve(row)
      })
    }
  }
  return { database, rows, exams }
}

describe('one-off current semester synchronizer', () => {
  it('sets only the resolved active AcademicTerm calendar to the authoritative dates', async () => {
    const database = { academicTerm: { update: vi.fn().mockResolvedValue({}) } }
    const scopedTarget = {
      ...target,
      userSemester: { ...target.userSemester, academicTerm: { ...target.userSemester.academicTerm, academicYear: '2026/2027', name: 'Semester 1' } }
    }

    await setAuthoritativeAcademicCalendar(database, scopedTarget)

    expect(AUTHORITATIVE_TEACHING_START).toBe('2026-08-10')
    expect(AUTHORITATIVE_RECESS_START).toBe('2026-09-28')
    expect(AUTHORITATIVE_RECESS_END).toBe('2026-10-02')
    expect(database.academicTerm.update).toHaveBeenCalledWith({
      where: { id: 'term-1' },
      data: {
        teachingStartDate: new Date('2026-08-09T16:00:00.000Z'),
        recessStartDate: new Date('2026-09-27T16:00:00.000Z'),
        recessEndDate: new Date('2026-10-01T16:00:00.000Z')
      }
    })
    expect(dateKey(scopedTarget.userSemester.academicTerm.teachingStartDate)).toBe('2026-08-10')
    expect(dateKey(scopedTarget.userSemester.academicTerm.recessStartDate)).toBe('2026-09-28')
    expect(dateKey(scopedTarget.userSemester.academicTerm.recessEndDate)).toBe('2026-10-02')
  })

  it('reports canonical teaching-week mappings from populated AcademicTerm metadata', () => {
    const mapping = teachingWeekMappingStatus(target.userSemester.academicTerm, [{
      id: 'weekly', dayOfWeek: 'MONDAY', startMinutes: 510, endMinutes: 620,
      recurrence: 'WEEKLY', weekNumbers: [], module: { code: 'HE5091' }
    }])
    const diagnostics = {
      teachingStartDate: target.userSemester.academicTerm.teachingStartDate,
      recessStartDate: target.userSemester.academicTerm.recessStartDate,
      recessEndDate: target.userSemester.academicTerm.recessEndDate,
      mapping
    }

    expect(mapping.safe).toBe(true)
    expect(mapping.checks.map(({ date, actual }) => [date, actual])).toEqual([
      ['2026-08-10', 1], ['2026-09-21', 7], ['2026-09-28', null],
      ['2026-09-30', null], ['2026-10-02', null], ['2026-10-05', 8], ['2026-10-12', 9]
    ])
    expect(academicCalendarDiagnosticLines(diagnostics)).toEqual([
      'Teaching start: 2026-08-10',
      'Recess start: 2026-09-28',
      'Recess end: 2026-10-02',
      '2026-08-10 -> Week 1',
      '2026-09-21 -> Week 7',
      '2026-09-28 -> RECESS / null',
      '2026-09-30 -> RECESS / null',
      '2026-10-02 -> RECESS / null',
      '2026-10-05 -> Week 8',
      '2026-10-12 -> Week 9'
    ])
  })

  it('replaces only the six scoped enrolments with nine canonical sessions and is idempotent', async () => {
    const { database, rows, exams } = fakeDatabase()

    await synchronizeCurrentSemester(database, target, CURRENT_SEMESTER_SEED)
    await synchronizeCurrentSemester(database, target, CURRENT_SEMESTER_SEED)

    const targetRows = rows.filter(row => row.userModuleEnrolmentId.startsWith('enrolment-offering-module-'))
    expect(targetRows).toHaveLength(9)
    expect(targetRows.every(row => row.source === 'MANUAL')).toBe(true)
    expect(targetRows.some(row => row.classType === 'OTHER')).toBe(false)
    expect(targetRows.some(row => row.userModuleEnrolmentId.endsWith('HE5091') && row.dayOfWeek === 'TUESDAY')).toBe(false)
    expect(targetRows.filter(row => row.userModuleEnrolmentId.endsWith('AB0403') && row.dayOfWeek === 'TUESDAY')).toHaveLength(1)
    expect(targetRows.filter(row => row.userModuleEnrolmentId.endsWith('AB1201') && row.dayOfWeek === 'TUESDAY')).toHaveLength(1)
    expect(rows.filter(row => row.id.startsWith('unrelated-'))).toHaveLength(2)
    expect(exams.size).toBe(4)
    expect(database.classSession.deleteMany).toHaveBeenLastCalledWith({ where: {
      userModuleEnrolmentId: { in: expect.arrayContaining([
        'enrolment-offering-module-AD1102', 'enrolment-offering-module-HE5091',
        'enrolment-offering-module-AB0403', 'enrolment-offering-module-AB1201',
        'enrolment-offering-module-AB1088', 'enrolment-offering-module-AB1501'
      ]) },
      userModuleEnrolment: { userId: 'dev-user', userSemesterId: 'active-semester' }
    } })
    expect(currentSemesterSeedSummary()).toEqual({ moduleCount: 6, academicUnits: 16, sessionCount: 9, examCount: 4 })
  })

  it('refuses to infer teaching weeks when the active term lacks teachingStartDate', () => {
    expect(teachingWeekMappingStatus({ teachingStartDate: null, endDate: target.userSemester.academicTerm.endDate }, [])).toEqual({
      safe: false, missingFields: ['teachingStartDate', 'recessStartDate', 'recessEndDate'], occurrenceCount: 0, checks: []
    })
  })
})
