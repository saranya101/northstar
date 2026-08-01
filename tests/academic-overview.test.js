import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))

import { buildAcademicOverview, getAcademicOverview } from '../server/services/academic-overview'
import { calculateGradeIntelligence } from '../shared/academic/grade-intelligence'

const root = new URL('..', import.meta.url).pathname
const pageSource = () => readFileSync(join(root, 'app/pages/app/index.vue'), 'utf8')

const now = new Date('2026-08-01T04:00:00.000Z')

function assessment(overrides = {}) {
  return {
    id: 'assessment-1',
    name: 'Quiz',
    type: 'QUIZ',
    weight: 20,
    officialDeadline: null,
    eventDate: null,
    status: 'NOT_STARTED',
    score: null,
    maximumScore: null,
    percentageScore: null,
    weightedScore: null,
    ...overrides
  }
}

function enrolment(code, overrides = {}) {
  return {
    id: `enrol-${code}`,
    targetGrade: 'A',
    targetPercentage: 88,
    targetLabel: 'A target',
    colour: 'MINERAL',
    offering: { module: { code, title: `${code} MODULE`, academicUnits: 3 } },
    assessments: [],
    _count: { classSessions: 1 },
    courseOutlineImports: [],
    ...overrides
  }
}

function semester(moduleEnrolments = []) {
  return {
    id: 'semester-1',
    academicTermId: 'term-1',
    academicTerm: { academicYear: '2026-2027', name: 'Semester 1' },
    moduleEnrolments
  }
}

describe('academic overview summary and structures', () => {
  it('summarises the active semester, module total, AUs and confirmed assessments', () => {
    const result = buildAcademicOverview(semester([
      enrolment('AB1201', { assessments: [assessment({ id: 'a1', weight: 50 }), assessment({ id: 'a2', weight: 50 })] }),
      enrolment('AB0403', { offering: { module: { code: 'AB0403', title: 'Programming', academicUnits: 1 } }, assessments: [assessment({ id: 'a3', weight: 100 })] })
    ]), now)

    expect(result.activeSemester.label).toBe('2026-2027 · Semester 1')
    expect(result.summary).toEqual({
      activeModuleCount: 2,
      totalAcademicUnits: 4,
      totalConfirmedAssessments: 3,
      completeAssessmentStructureCount: 2,
      missingAssessmentInformationCount: 0
    })
  })

  it('distinguishes complete and incomplete assessment structures', () => {
    const result = buildAcademicOverview(semester([
      enrolment('COMPLETE', { assessments: [assessment({ id: 'a1', weight: 40 }), assessment({ id: 'a2', weight: 60 })] }),
      enrolment('MISSING', { assessments: [assessment({ id: 'a3', weight: null }), assessment({ id: 'a4', weight: 40 })] }),
      enrolment('EMPTY')
    ]), now)

    expect(result.summary.completeAssessmentStructureCount).toBe(1)
    expect(result.summary.missingAssessmentInformationCount).toBe(2)
    expect(result.modules.find(item => item.code === 'COMPLETE').readiness).toBe('MISSING_DATES')
    expect(result.modules.find(item => item.code === 'MISSING').readiness).toBe('INCOMPLETE_ASSESSMENT_STRUCTURE')
    expect(result.modules.find(item => item.code === 'EMPTY').readiness).toBe('NO_ASSESSMENTS')
  })

  it('works when the active semester has no modules', () => {
    const result = buildAcademicOverview(semester(), now)
    expect(result.summary.activeModuleCount).toBe(0)
    expect(result.summary.totalAcademicUnits).toBe(0)
    expect(result.attention).toEqual([])
    expect(result.upcomingAssessments).toEqual([])
    expect(result.modules).toEqual([])
  })
})

describe('academic overview attention and dates', () => {
  it('creates missing-date attention items and never invents dates from teaching-week text', () => {
    const item = assessment({ id: 'week-8-quiz', name: 'Mid-Term Quiz', weight: 20 })
    item.instructions = 'Tuesday of Week 8 at 7pm'
    const result = buildAcademicOverview(semester([enrolment('AB1201', { assessments: [item] })]), now)

    expect(result.attention).toContainEqual(expect.objectContaining({ kind: 'MISSING_DATE', to: '/app/assessments/week-8-quiz' }))
    expect(result.upcomingAssessments).toEqual([])
  })

  it('orders upcoming assessments by persisted date only', () => {
    const result = buildAcademicOverview(semester([
      enrolment('AB1201', { assessments: [
        assessment({ id: 'later', name: 'Final', officialDeadline: new Date('2026-10-20T01:00:00.000Z') }),
        assessment({ id: 'earlier', name: 'Quiz', officialDeadline: new Date('2026-09-15T11:00:00.000Z') })
      ] }),
      enrolment('AB0403', { assessments: [assessment({ id: 'middle', name: 'Presentation', eventDate: new Date('2026-10-01T03:00:00.000Z') })] })
    ]), now)

    expect(result.upcomingAssessments.map(item => item.id)).toEqual(['earlier', 'middle', 'later'])
    expect(result.upcomingAssessments.find(item => item.id === 'middle').dateSource).toBe('EVENT_DATE')
  })

  it('links module-level attention to the correct dossier sections', () => {
    const result = buildAcademicOverview(semester([
      enrolment('AB1501', { targetGrade: null, assessments: [] })
    ]), now)

    expect(result.attention).toContainEqual(expect.objectContaining({ kind: 'NO_ASSESSMENTS', to: '/app/modules/enrol-AB1501#assessments' }))
    expect(result.attention).toContainEqual(expect.objectContaining({ kind: 'NO_TARGET_GRADE', to: '/app/modules/enrol-AB1501' }))
    expect(result.modules[0].to).toBe('/app/modules/enrol-AB1501')
  })

  it('includes existing course-outline imports that still require review', () => {
    const result = buildAcademicOverview(semester([
      enrolment('AB0403', { courseOutlineImports: [{ id: 'import-1', originalFileName: 'outline.pdf', sourceLabel: 'Outline', createdAt: now }] })
    ]), now)

    expect(result.attention).toContainEqual(expect.objectContaining({
      kind: 'REVIEW_REQUIRED_IMPORT',
      to: '/app/course-outline-imports/import-1',
      description: 'outline.pdf'
    }))
  })
})

describe('academic overview grade position', () => {
  it('reuses the deterministic grade intelligence calculation', () => {
    const assessments = [
      assessment({ id: 'coursework', weight: 40, score: 36, maximumScore: 40, percentageScore: 90, weightedScore: 36, status: 'GRADED' }),
      assessment({ id: 'final', weight: 60 })
    ]
    const result = buildAcademicOverview(semester([enrolment('AB1201', { assessments })]), now)
    const expected = calculateGradeIntelligence(assessments, 88)

    expect(result.modules[0].grade).toEqual({
      targetPercentage: expected.targetPercentage,
      confirmedWeight: expected.confirmedWeight,
      gradedWeight: expected.gradedWeight,
      currentWeightedScore: expected.currentWeightedScore,
      remainingWeight: expected.remainingWeight,
      requiredAverage: expected.requiredAverage
    })
  })

  it('works when target grades and target percentages are not set', () => {
    const result = buildAcademicOverview(semester([
      enrolment('HE5091', { targetGrade: null, targetPercentage: null, assessments: [assessment({ weight: 100 })] })
    ]), now)

    expect(result.modules[0].targetGrade).toBeNull()
    expect(result.modules[0].grade.requiredAverage).toBeNull()
  })
})

describe('academic overview ownership and query boundaries', () => {
  it('filters the active semester, enrolments and assessments by the authenticated user', async () => {
    const findFirst = vi.fn().mockResolvedValue(semester())
    const database = { userSemester: { findFirst } }
    await getAcademicOverview('user-1', database, now)

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', isActive: true },
      select: expect.objectContaining({
        moduleEnrolments: expect.objectContaining({
          where: { userId: 'user-1', status: 'ACTIVE' },
          select: expect.objectContaining({
            assessments: expect.objectContaining({ where: { userId: 'user-1', status: { not: 'CANCELLED' } } }),
            courseOutlineImports: expect.objectContaining({ where: { userId: 'user-1', status: 'REVIEW_REQUIRED' } })
          })
        })
      })
    }))
  })
})

describe('academic overview page contract', () => {
  it('renders the required sections, empty states and module dossier links', () => {
    const page = pageSource()
    expect(page).toContain('Semester command centre')
    expect(page).toContain('Needs attention')
    expect(page).toContain('Upcoming assessments')
    expect(page).toContain('Grade position')
    expect(page).toContain('Module readiness')
    expect(page).toContain('No confirmed assessment dates yet')
    expect(page).toContain(':to="module.to"')
  })

  it('refreshes through one overview composable without top-level data awaits', () => {
    const page = pageSource()
    const setup = page.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1] || ''
    expect(page).toContain('useAcademicOverview()')
    expect(page).toContain('onActivated')
    expect(setup).not.toMatch(/^await\s+/m)
    expect(page).not.toContain('useModules()')
    expect(page).not.toContain('useTimetable()')
    expect(page).not.toContain('/api/opportunities')
  })
})
