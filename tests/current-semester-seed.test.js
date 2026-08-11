import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURRENT_SEMESTER_SEED, classSessionIdentity, currentSemesterSeedSummary, validateCurrentSemesterSeed } from '../scripts/current-semester-seed-data.js'
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, SESSION_DELIVERY_MODES, SESSION_RECURRENCES } from '../shared/schemas/timetable.js'

describe('current semester development seed data', () => {
  it('loads the generated Prisma client when started directly with Node', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/seed-current-semester.js', import.meta.url))], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@localhost:1/unused', SEED_USER_EMAIL: '' }
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('SEED_USER_EMAIL is required')
    expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
  })

  it('contains the exact requested semester totals and module indexes', () => {
    expect(validateCurrentSemesterSeed()).toEqual({ moduleCount: 6, academicUnits: 16, sessionCount: 9, examCount: 4 })
    expect(currentSemesterSeedSummary()).toEqual({ moduleCount: 6, academicUnits: 16, sessionCount: 9, examCount: 4 })
    expect(Object.fromEntries(CURRENT_SEMESTER_SEED.modules.map(module => [module.code, module.indexNumber]))).toEqual({ AD1102: '01128', HE5091: '01075', AB0403: '00462', AB1201: '00105', AB1088: '01210', AB1501: '00879' })
  })

  it('uses stable unique session identities for repeatable upserts', () => {
    const sessions = CURRENT_SEMESTER_SEED.modules.flatMap(module => module.sessions)
    const identities = CURRENT_SEMESTER_SEED.modules.flatMap(module => module.sessions.map(session => `${module.code}|${classSessionIdentity(session)}`))
    expect(new Set(identities).size).toBe(9)
    expect(identities).toEqual(CURRENT_SEMESTER_SEED.modules.flatMap(module => module.sessions.map(session => `${module.code}|${classSessionIdentity({ ...session })}`)))
    expect(sessions.every(session => CLASS_SESSION_TYPES.includes(session.classType) && DAYS_OF_WEEK.includes(session.dayOfWeek) && SESSION_RECURRENCES.includes(session.recurrence) && SESSION_DELIVERY_MODES.includes(session.deliveryMode))).toBe(true)
  })

  it('preserves every explicit custom teaching-week array', () => {
    const custom = Object.fromEntries(CURRENT_SEMESTER_SEED.modules.flatMap(module => module.sessions.filter(session => session.recurrence === 'CUSTOM').map(session => [`${module.code}-${session.groupLabel}`, session.weekNumbers])))
    expect(custom).toEqual({
      'HE5091-NBS16': [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      'AB1088-1': [2, 3, 6, 7, 8, 9, 10, 11],
      'AB1501-19': [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    })
    expect(CURRENT_SEMESTER_SEED.modules.find(module => module.code === 'AB1088').sessions[0].weekNumbers).toEqual([2, 3, 4, 5, 10, 11])
  })
})
