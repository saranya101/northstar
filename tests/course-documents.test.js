import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import {
  buildDocumentProposals,
  classifyDocumentChange,
  createCourseDocument,
  getCourseDocument,
  reviewCourseDocument
} from '../server/services/course-documents'

const source = (value, extra = {}) => ({ value, confidence: .9, pageNumber: 2, sourceExcerpt: `Evidence for ${value}`, ...extra })
const candidate = (overrides = {}) => ({
  sourceOrder: 0,
  name: source('Quiz'), type: source('QUIZ'), weight: source(20), officialDeadline: source(null), eventDate: source(null),
  submissionPlatform: source(null), submissionUrl: source(null), instructions: source('Tuesday of Week 8; 7:00 PM–8:00 PM'),
  examFormat: source('closed-book, Online'), groupAssessment: source(false), durationMinutes: source(null), openBook: source(false),
  deliverables: [], rubricHeadings: [], warnings: [], ...overrides
})
const parsed = (assessment = candidate(), weeks = []) => ({ parserVersion: 'deterministic-3', facts: [], assessments: [assessment], weeks, warnings: [], academicYear: null, semesterLabel: null, historical: false })
const enrolment = (overrides = {}) => ({
  id: 'e1', offering: { module: { code: 'AB1201', title: 'Financial Management', academicUnits: 3 }, academicTerm: { academicYear: '2026–2027', name: 'Semester 1' } },
  assessments: [{ id: 'a1', name: 'Quiz', normalizedName: 'quiz', type: 'QUIZ', weight: 20, officialDeadline: null, eventDate: null, instructions: null, examFormat: null, groupAssessment: false }],
  weeklyTopics: [], privateFacts: [], ...overrides
})

describe('course document matching', () => {
  it('classifies missing, conflicting and unchanged values deterministically', () => {
    expect(classifyDocumentChange(null, 'value')).toBe('FILL_MISSING')
    expect(classifyDocumentChange(20, 25, { conflict: true })).toBe('CONFLICT')
    expect(classifyDocumentChange(20, 20)).toBe('NO_CHANGE')
  })

  it('enriches the same assessment instead of adding a duplicate', () => {
    const proposals = buildDocumentProposals(parsed(), enrolment())
    expect(proposals.some(item => item.fieldName === 'assessment' && item.classification === 'ADD')).toBe(false)
    expect(proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: 'a1', fieldName: 'weight', classification: 'NO_CHANGE' }),
      expect.objectContaining({ targetId: 'a1', fieldName: 'instructions', classification: 'FILL_MISSING' })
    ]))
  })

  it('requires review for a conflicting weight', () => {
    const proposals = buildDocumentProposals(parsed(candidate({ weight: source(25) })), enrolment())
    expect(proposals).toContainEqual(expect.objectContaining({ targetId: 'a1', fieldName: 'weight', currentValue: 20, proposedValue: 25, classification: 'CONFLICT' }))
  })

  it('merges weekly topics by week number without duplicates', () => {
    const week = { weekNumber: 8, topic: 'Cost of Capital', reading: null, activity: 'Quiz', importantDate: 'Tue; 7:00 PM–8:00 PM', confidence: .9, pageNumber: 6, sourceExcerpt: 'Week 8 quiz' }
    const existing = { id: 'w8', ...week, reading: 'C11', importantDate: null }
    const proposals = buildDocumentProposals(parsed(candidate(), [week]), enrolment({ weeklyTopics: [existing] }))
    expect(proposals).toContainEqual(expect.objectContaining({ targetType: 'WEEKLY_TOPIC', targetId: 'w8', classification: 'UPDATE', proposedValue: expect.objectContaining({ reading: 'C11', importantDate: 'Tue; 7:00 PM–8:00 PM' }) }))
    expect(proposals.filter(item => item.targetType === 'WEEKLY_TOPIC')).toHaveLength(1)
  })
})

describe('course document persistence boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not expose another user document', async () => {
    const database = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getCourseDocument('other-user', 'd1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.courseOutlineImport.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1', userId: 'other-user' } }))
  })

  it('detects a duplicate file hash without creating another document', async () => {
    const existing = { id: 'd1', userModuleEnrolmentId: 'e1', sourceLabel: 'Brief', documentType: 'ASSESSMENT_BRIEF', status: 'REVIEW_REQUIRED', duplicateCount: 0, proposals: [], _count: { proposals: 0 } }
    const updated = { ...existing, duplicateCount: 1 }
    const database = {
      userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(enrolment()) },
      courseOutlineImport: { findFirst: vi.fn().mockResolvedValue(existing), update: vi.fn().mockResolvedValue(updated), create: vi.fn() }
    }
    const result = await createCourseDocument('u1', 'e1', { sha256Hash: 'a'.repeat(64) }, database)
    expect(result).toMatchObject({ id: 'd1', duplicate: true, duplicateCount: 1 })
    expect(database.courseOutlineImport.create).not.toHaveBeenCalled()
  })

  it('allows multiple different source documents for one module', async () => {
    const create = vi.fn(async ({ data }) => ({ id: `d${create.mock.calls.length}`, ...data, proposals: data.proposals.create, _count: { proposals: data.proposals.create.length } }))
    const database = {
      userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(enrolment()) },
      courseOutlineImport: { findFirst: vi.fn().mockResolvedValue(null), create }
    }
    const base = { documentType: 'ANNOUNCEMENT', displayTitle: 'Update', mimeType: 'text/plain', fileSize: 30, sourceType: 'TEXT', sourceDate: null, extractedText: 'Quiz | 20% | Tuesday of Week 8', extractionConfidence: 1 }
    await createCourseDocument('u1', 'e1', { ...base, sha256Hash: 'a'.repeat(64) }, database)
    await createCourseDocument('u1', 'e1', { ...base, displayTitle: 'Update 2', sha256Hash: 'b'.repeat(64) }, database)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('proposal review transaction', () => {
  const now = new Date('2026-08-01T00:00:00.000Z')
  function databaseFor(proposal, pendingCount = 0) {
    const document = { id: 'd1', userId: 'u1', userModuleEnrolmentId: 'e1', displayTitle: 'Announcement', sourceLabel: 'Announcement', sourceType: 'TEXT', originalFileName: null, status: 'REVIEW_REQUIRED', updatedAt: now, proposals: [proposal] }
    const tx = {
      courseOutlineImport: { findFirst: vi.fn().mockResolvedValue(document), update: vi.fn() },
      courseDocumentProposal: { update: vi.fn(), count: vi.fn().mockResolvedValue(pendingCount) },
      assessment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirst: vi.fn(), create: vi.fn() },
      moduleWeeklyTopic: { upsert: vi.fn() }, userModuleFact: { upsert: vi.fn() },
      courseDocumentEvidence: { upsert: vi.fn() }, assessmentProvenance: { upsert: vi.fn() }
    }
    return { tx, database: { $transaction: callback => callback(tx) } }
  }

  it('rejects a proposal without updating module data', async () => {
    const proposal = { id: 'p1', status: 'PENDING', targetType: 'ASSESSMENT', targetId: 'a1', fieldName: 'instructions', proposedValue: 'Week 8', classification: 'FILL_MISSING' }
    const { tx, database } = databaseFor(proposal)
    await reviewCourseDocument('u1', 'd1', { expectedUpdatedAt: now.toISOString(), decisions: [{ id: 'p1', action: 'REJECT' }] }, database)
    expect(tx.assessment.updateMany).not.toHaveBeenCalled()
    expect(tx.courseDocumentProposal.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'REJECTED' } })
  })

  it('updates an existing assessment and retains document/page evidence', async () => {
    const proposal = { id: 'p1', status: 'PENDING', targetType: 'ASSESSMENT', targetId: 'a1', fieldName: 'instructions', proposedValue: 'Week 8', classification: 'FILL_MISSING', pageNumber: 3, sourceExcerpt: 'Tuesday of Week 8', confidence: .9 }
    const { tx, database } = databaseFor(proposal)
    const result = await reviewCourseDocument('u1', 'd1', { expectedUpdatedAt: now.toISOString(), decisions: [{ id: 'p1', action: 'APPROVE' }] }, database)
    expect(result).toMatchObject({ status: 'CONFIRMED', appliedCount: 1 })
    expect(tx.assessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'a1', userId: 'u1' }), data: { instructions: 'Week 8' } }))
    expect(tx.assessmentProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ sourceImportId: 'd1', assessmentId: 'a1', pageNumber: 3, sourceExcerpt: 'Tuesday of Week 8' }) }))
  })

  it('is idempotent after the document is confirmed', async () => {
    const tx = { courseOutlineImport: { findFirst: vi.fn().mockResolvedValue({ id: 'd1', status: 'CONFIRMED', proposals: [] }) } }
    const database = { $transaction: callback => callback(tx) }
    await expect(reviewCourseDocument('u1', 'd1', { expectedUpdatedAt: now.toISOString(), decisions: [{ id: 'p1', action: 'APPROVE' }] }, database)).resolves.toEqual({ status: 'CONFIRMED', idempotent: true, appliedCount: 0 })
  })

  it('keeps supporting evidence from separate documents', async () => {
    const proposal = { id: 'p1', status: 'PENDING', targetType: 'ASSESSMENT', targetId: 'a1', fieldName: 'weight', proposedValue: 20, classification: 'NO_CHANGE' }
    const first = databaseFor(proposal)
    await reviewCourseDocument('u1', 'd1', { expectedUpdatedAt: now.toISOString(), decisions: [{ id: 'p1', action: 'APPROVE' }] }, first.database)
    expect(first.tx.assessmentProvenance.upsert.mock.calls[0][0].where.assessmentId_sourceImportId_fieldName.sourceImportId).toBe('d1')
  })
})
