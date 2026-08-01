import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { buildMissingOccurrences, hasUnverifiedSubmission, planTeachingWeeks, recurringCourseworkProgress } from '../shared/academic/recurring-coursework'
import { createRecurringCourseworkSchema, updateRecurringOccurrenceSchema, updateRecurringCourseworkSchema } from '../shared/schemas/recurring-coursework'
import {
  archiveRecurringCoursework,
  createRecurringCoursework,
  generateMissingOccurrences,
  getRecurringCoursework,
  updateRecurringCoursework,
  updateRecurringOccurrence,
  updateSubmissionVerification
} from '../server/services/recurring-coursework'
import { readFileSync } from 'node:fs'

const now = new Date('2026-08-01T00:00:00.000Z')
const definition = (overrides = {}) => ({ id: 'r1', userId: 'u1', userModuleEnrolmentId: 'e1', title: 'LAMS Attempts', type: 'LAMS', frequency: 'WEEKLY', totalExpected: 13, firstTeachingWeek: 1, lastTeachingWeek: 13, recessWeeks: [], includeRecessWeeks: false, graded: true, totalAssessmentWeight: 10, completeBeforeClass: true, timingNote: 'Before seminar', status: 'ACTIVE', assessmentId: 'a1', description: null, createdAt: now, updatedAt: now, occurrences: [], assessment: { id: 'a1', name: 'LAMS Attempts', weight: 10, type: 'OTHER' }, ...overrides })
const occurrence = (sequenceNumber, overrides = {}) => ({ id: `o${sequenceNumber}`, userId: 'u1', recurringCourseworkId: 'r1', sequenceNumber, teachingWeek: sequenceNumber, status: 'NOT_STARTED', workCompleted: false, finalConfirmationClicked: false, gradeCentreChecked: false, markCaptured: false, officialDueAt: null, startedAt: null, submittedAt: null, verifiedAt: null, score: null, maximumScore: null, createdAt: now, updatedAt: now, ...overrides })

describe('recurring coursework generation and progress', () => {
  it('creates weekly teaching weeks and fixed-count unknown occurrences', () => {
    expect(planTeachingWeeks(definition())).toEqual(Array.from({ length: 13 }, (_, index) => index + 1))
    expect(planTeachingWeeks({ frequency: 'CUSTOM', totalExpected: 8 })).toEqual(Array(8).fill(null))
  })

  it('handles week ranges, fortnightly cadence and recess weeks without guessing dates', () => {
    expect(planTeachingWeeks({ frequency: 'FORTNIGHTLY', totalExpected: 4, firstTeachingWeek: 2, lastTeachingWeek: 8, recessWeeks: [] })).toEqual([2, 4, 6, 8])
    expect(planTeachingWeeks({ frequency: 'WEEKLY', totalExpected: 5, firstTeachingWeek: 1, lastTeachingWeek: 5, recessWeeks: [3] })).toEqual([1, 2, 4, 5, null])
    expect(planTeachingWeeks({ frequency: 'WEEKLY', totalExpected: 5, firstTeachingWeek: 1, lastTeachingWeek: 5, recessWeeks: [3], includeRecessWeeks: true })).toEqual([1, 2, 3, 4, 5])
  })

  it('breaks equal deadline ties by occurrence sequence', () => {
    const deadline = '2026-08-08T10:00:00.000Z'
    const progress = recurringCourseworkProgress([occurrence(2, { officialDueAt: deadline }), occurrence(1, { officialDueAt: deadline })])
    expect(progress.nextKnownDeadline.id).toBe('o1')
  })

  it('generates missing occurrences idempotently', () => {
    const base = { frequency: 'CUSTOM', totalExpected: 4 }
    expect(buildMissingOccurrences(base, [occurrence(1), occurrence(2)])).toEqual([{ sequenceNumber: 3, teachingWeek: null }, { sequenceNumber: 4, teachingWeek: null }])
    expect(buildMissingOccurrences(base, [1, 2, 3, 4].map(occurrence))).toEqual([])
  })

  it('calculates completed, remaining, verified, missed, warnings, deadlines and captured marks', () => {
    const records = [
      occurrence(1, { status: 'SUBMITTED', workCompleted: true, submittedAt: now, score: 8, maximumScore: 10 }),
      occurrence(2, { status: 'VERIFIED', workCompleted: true, finalConfirmationClicked: true, gradeCentreChecked: true, score: 9, maximumScore: 10 }),
      occurrence(3, { status: 'MISSED' }), occurrence(4, { status: 'EXCUSED' }),
      occurrence(5, { officialDueAt: '2026-08-08T10:00:00.000Z' })
    ]
    expect(recurringCourseworkProgress(records)).toMatchObject({ completedCount: 2, remainingCount: 1, submittedCount: 2, verifiedCount: 1, missedCount: 1, excusedCount: 1, completionPercentage: 40, unverifiedSubmissionCount: 1, nextIncomplete: { id: 'o5' }, nextKnownDeadline: { id: 'o5' }, capturedMarks: { score: 17, maximumScore: 20, percentage: 85 } })
    expect(hasUnverifiedSubmission(records[0])).toBe(true)
  })
})

describe('recurring coursework validation', () => {
  const valid = { title: 'Weekly questions', type: 'ONLINE_ASSIGNMENT', frequency: 'WEEKLY', totalExpected: 8, firstTeachingWeek: 1, lastTeachingWeek: 8, graded: false }
  it('rejects invalid counts, ranges, ungraded weights and bonus scores', () => {
    expect(createRecurringCourseworkSchema.safeParse(valid).success).toBe(true)
    expect(createRecurringCourseworkSchema.parse({ ...valid, timingNote: 'Before seminar' }).timingNote).toBe('Before seminar')
    expect(createRecurringCourseworkSchema.safeParse({ ...valid, totalExpected: 0 }).success).toBe(false)
    expect(createRecurringCourseworkSchema.safeParse({ ...valid, firstTeachingWeek: 9 }).success).toBe(false)
    expect(createRecurringCourseworkSchema.safeParse({ ...valid, totalAssessmentWeight: 10 }).success).toBe(false)
    expect(updateRecurringOccurrenceSchema.safeParse({ expectedUpdatedAt: now.toISOString(), score: 11, maximumScore: 10 }).success).toBe(false)
  })

  it('requires stale-write protection and explicit incomplete-removal confirmation', () => {
    expect(updateRecurringCourseworkSchema.safeParse({ expectedUpdatedAt: now.toISOString(), totalExpected: 6, removeIncompleteOccurrences: true }).success).toBe(true)
    expect(updateRecurringCourseworkSchema.safeParse({ totalExpected: 6 }).success).toBe(false)
    expect(updateRecurringCourseworkSchema.parse({ expectedUpdatedAt: now.toISOString(), title: 'Updated title' })).toEqual({ expectedUpdatedAt: now.toISOString(), title: 'Updated title' })
    const statusOnly = updateRecurringOccurrenceSchema.parse({ expectedUpdatedAt: now.toISOString(), status: 'SUBMITTED' })
    expect(statusOnly).toEqual({ expectedUpdatedAt: now.toISOString(), status: 'SUBMITTED' })
  })
})

describe('recurring coursework persistence boundaries', () => {
  function createDatabase({ enrolment = { id: 'e1' }, assessment = { id: 'a1' } } = {}) {
    const state = { requirement: null, occurrences: [] }
    const tx = {
      userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(enrolment) },
      assessment: { findFirst: vi.fn().mockResolvedValue(assessment), update: vi.fn() },
      recurringCoursework: {
        create: vi.fn(async ({ data }) => (state.requirement = definition({ ...data, occurrences: [], assessment: assessment ? { ...assessment, name: 'LAMS Attempts', weight: 10, type: 'OTHER' } : null }))),
        findUnique: vi.fn(async () => ({ ...state.requirement, occurrences: state.occurrences }))
      },
      recurringCourseworkOccurrence: { createMany: vi.fn(async ({ data }) => { state.occurrences.push(...data.map(item => occurrence(item.sequenceNumber, item))); return { count: data.length } }) }
    }
    return { tx, database: { $transaction: callback => callback(tx) }, state }
  }

  it('creates weekly coursework transactionally, links an owned assessment and leaves it unchanged', async () => {
    const { tx, database } = createDatabase()
    const result = await createRecurringCoursework('u1', 'e1', definition(), database)
    expect(result.occurrences).toHaveLength(13)
    expect(result.assessment).toMatchObject({ id: 'a1', weight: 10 })
    expect(tx.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', userId: 'u1', userModuleEnrolmentId: 'e1' } }))
    expect(tx.assessment.update).not.toHaveBeenCalled()
  })

  it('creates an ungraded fixed-count requirement without an assessment', async () => {
    const { database } = createDatabase({ assessment: null })
    const result = await createRecurringCoursework('u1', 'e1', { ...definition(), assessmentId: null, graded: false, totalAssessmentWeight: null, frequency: 'CUSTOM', totalExpected: 8, firstTeachingWeek: null, lastTeachingWeek: null }, database)
    expect(result.occurrences).toHaveLength(8)
    expect(result.assessment).toBeNull()
    expect(result.totalAssessmentWeight).toBeNull()
  })

  it('enforces module, assessment, requirement and occurrence ownership', async () => {
    const missingModule = createDatabase({ enrolment: null })
    await expect(createRecurringCoursework('u2', 'e1', definition(), missingModule.database)).rejects.toMatchObject({ statusCode: 404 })
    const missingAssessment = createDatabase({ assessment: null })
    await expect(createRecurringCoursework('u1', 'e1', definition(), missingAssessment.database)).rejects.toMatchObject({ statusCode: 400 })
    await expect(getRecurringCoursework('u2', 'r1', { recurringCoursework: { findFirst: vi.fn().mockResolvedValue(null) } })).rejects.toMatchObject({ statusCode: 404 })
    await expect(updateRecurringOccurrence('u2', 'o1', { expectedUpdatedAt: now.toISOString(), status: 'SUBMITTED' }, { recurringCourseworkOccurrence: { findFirst: vi.fn().mockResolvedValue(null) } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('adds occurrences when expected count increases and only removes incomplete excess rows with confirmation', async () => {
    const current = definition({ totalExpected: 2, occurrences: [occurrence(1, { status: 'VERIFIED' }), occurrence(2)] })
    const created = []
    const tx = {
      recurringCoursework: { findFirst: vi.fn().mockResolvedValue(current), update: vi.fn(), findUnique: vi.fn().mockResolvedValue({ ...current, totalExpected: 4, occurrences: [occurrence(1), occurrence(2), occurrence(3), occurrence(4)] }) },
      recurringCourseworkOccurrence: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue(current.occurrences), createMany: vi.fn(async ({ data }) => { created.push(...data) }) }
    }
    const database = { $transaction: callback => callback(tx) }
    await updateRecurringCoursework('u1', 'r1', { expectedUpdatedAt: now.toISOString(), totalExpected: 4 }, database)
    expect(created.map(item => item.sequenceNumber)).toEqual([3, 4])
    expect(tx.recurringCourseworkOccurrence.deleteMany).not.toHaveBeenCalled()

    tx.recurringCoursework.findFirst.mockResolvedValue(definition({ totalExpected: 4, occurrences: [occurrence(1, { status: 'VERIFIED' }), occurrence(2), occurrence(3), occurrence(4)] }))
    tx.recurringCourseworkOccurrence.findMany.mockResolvedValue([occurrence(1, { status: 'VERIFIED' }), occurrence(2)])
    await updateRecurringCoursework('u1', 'r1', { expectedUpdatedAt: now.toISOString(), totalExpected: 2, removeIncompleteOccurrences: true }, database)
    expect(tx.recurringCourseworkOccurrence.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ sequenceNumber: { gt: 2 }, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } }) })
  })

  it('generates idempotently and blocks archived requirements', async () => {
    const active = definition({ totalExpected: 2, occurrences: [occurrence(1), occurrence(2)] })
    const tx = { recurringCoursework: { findFirst: vi.fn().mockResolvedValue(active), findUnique: vi.fn().mockResolvedValue(active) }, recurringCourseworkOccurrence: { createMany: vi.fn() } }
    await generateMissingOccurrences('u1', 'r1', now.toISOString(), { $transaction: callback => callback(tx) })
    expect(tx.recurringCourseworkOccurrence.createMany).not.toHaveBeenCalled()
    tx.recurringCoursework.findFirst.mockResolvedValue({ ...active, status: 'ARCHIVED' })
    await expect(generateMissingOccurrences('u1', 'r1', now.toISOString(), { $transaction: callback => callback(tx) })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('archives only an owned requirement', async () => {
    const database = { recurringCoursework: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } }
    await expect(archiveRecurringCoursework('u1', 'r1', database)).resolves.toEqual({ status: 'ARCHIVED' })
    expect(database.recurringCoursework.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r1', userId: 'u1' }) }))
  })
})

describe('submission verification persistence', () => {
  it('keeps submitted work unverified until manual confirmation and Grade Centre checks are recorded', async () => {
    const submitted = occurrence(1, { status: 'SUBMITTED', workCompleted: true, submittedAt: now })
    const update = vi.fn(async ({ data }) => ({ ...submitted, ...data, updatedAt: new Date('2026-08-01T00:01:00.000Z') }))
    const database = { recurringCourseworkOccurrence: { findFirst: vi.fn().mockResolvedValue(submitted), update } }
    const result = await updateSubmissionVerification('u1', 'o1', { expectedUpdatedAt: now.toISOString(), finalConfirmationClicked: true, gradeCentreChecked: true }, database)
    expect(result.status).toBe('VERIFIED')
    expect(result.verifiedAt).not.toBeNull()
  })

  it('records a valid score without touching grade intelligence or the assessment record', async () => {
    const current = occurrence(1)
    const update = vi.fn(async ({ data }) => ({ ...current, ...data }))
    const database = { recurringCourseworkOccurrence: { findFirst: vi.fn().mockResolvedValue(current), update }, assessment: { update: vi.fn() } }
    const result = await updateRecurringOccurrence('u1', 'o1', { expectedUpdatedAt: now.toISOString(), score: 8, maximumScore: 10 }, database)
    expect(result).toMatchObject({ score: 8, maximumScore: 10, markCaptured: true })
    expect(database.assessment.update).not.toHaveBeenCalled()
  })
})

describe('recurring coursework frontend contract', () => {
  it('adds a module Coursework section, human labels, TBA weights and verification warnings', () => {
    const modulePage = readFileSync(new URL('../app/pages/app/modules/[id].vue', import.meta.url), 'utf8')
    const panel = readFileSync(new URL('../app/components/academic/RecurringCourseworkPanel.vue', import.meta.url), 'utf8')
    const tracker = readFileSync(new URL('../app/pages/app/recurring-coursework/[id].vue', import.meta.url), 'utf8')
    expect(modulePage).toContain('<AcademicRecurringCourseworkPanel')
    expect(panel).toContain(':items="typeItems"')
    expect(panel).toContain("replaceAll('_', ' ')")
    expect(panel).toContain("'TBA'")
    expect(panel).toContain('Northstar has not checked NTULearn')
    expect(tracker).toContain('Final confirmation clicked')
    expect(tracker).toContain('Grade Centre checked manually')
    expect(tracker).not.toContain('proofNote')
  })
})
