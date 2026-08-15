import { beforeEach, describe, expect, it, vi } from 'vitest'

const canonical = vi.hoisted(() => ({
  createOpportunity: vi.fn(), findOpportunityDuplicates: vi.fn(), createTask: vi.fn()
}))
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
vi.mock('../server/services/opportunities', () => ({
  createOpportunity: canonical.createOpportunity,
  findOpportunityDuplicates: canonical.findOpportunityDuplicates
}))
vi.mock('../server/services/tasks', () => ({ createTask: canonical.createTask }))

import { convertMailToOpportunity, convertMailToTask, createMailIntake, dismissMailIntake, getMailIntake, retainMailAsNote } from '../server/services/mail-intakes.js'
import { NTU_MAIL_FIXTURES } from './fixtures/ntu-mail.js'

const createdAt = new Date('2026-08-15T02:00:00.000Z')

function databaseFixture() {
  let records = []
  let tick = 0
  const database = {
    mailIntake: {
      findUnique: vi.fn(({ where }) => Promise.resolve(records.find(item => item.userId === where.userId_contentFingerprint.userId && item.contentFingerprint === where.userId_contentFingerprint.contentFingerprint) || null)),
      create: vi.fn(({ data }) => {
        const record = { id: `mail-${records.length + 1}`, ...data, status: 'NEW', createdAt, updatedAt: createdAt, convertedOpportunityId: null, convertedTaskId: null, convertedOpportunity: null, convertedTask: null }
        records.push(record)
        return Promise.resolve(record)
      }),
      findFirst: vi.fn(({ where }) => Promise.resolve(records.find(item => item.id === where.id && item.userId === where.userId) || null)),
      findMany: vi.fn(({ where }) => Promise.resolve(records.filter(item => item.userId === where.userId))),
      updateMany: vi.fn(({ where, data }) => {
        const record = records.find(item => item.id === where.id && item.userId === where.userId)
        if (!record) return Promise.resolve({ count: 0 })
        Object.assign(record, data, { updatedAt: new Date(createdAt.getTime() + (++tick * 1000)) })
        if (data.convertedOpportunityId) record.convertedOpportunity = { id: data.convertedOpportunityId, title: 'Converted opportunity', organisation: 'Example Capital' }
        if (data.convertedTaskId) record.convertedTask = { id: data.convertedTaskId, title: 'Converted task' }
        return Promise.resolve({ count: 1 })
      })
    },
    userModuleEnrolment: { findFirst: vi.fn().mockResolvedValue(null) },
    opportunity: { create: vi.fn() }, task: { create: vi.fn() }, assessment: { create: vi.fn() }
  }
  return { database, records }
}

describe('mail intake persistence and review', () => {
  beforeEach(() => {
    canonical.createOpportunity.mockReset().mockResolvedValue({ id: 'opportunity-1' })
    canonical.findOpportunityDuplicates.mockReset().mockResolvedValue([])
    canonical.createTask.mockReset().mockResolvedValue({ id: 'task-1' })
  })

  it('retains raw evidence and creates no consequential records automatically', async () => {
    const { database } = databaseFixture()
    const result = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.internship }, database)
    expect(result.rawText).toBe(NTU_MAIL_FIXTURES.internship)
    expect(result).toMatchObject({ userId: 'user-1', classification: 'OPPORTUNITY', status: 'NEW', duplicate: false })
    expect(canonical.createOpportunity).not.toHaveBeenCalled()
    expect(canonical.createTask).not.toHaveBeenCalled()
    expect(database.assessment.create).not.toHaveBeenCalled()
  })

  it('retains malformed evidence as uncertain when an interpreter fails', async () => {
    const { database } = databaseFixture()
    const interpreter = { key: 'failing-test-provider', interpret: vi.fn().mockRejectedValue(new Error('private provider detail')) }
    const result = await createMailIntake('user-1', { rawText: 'A malformed but sufficiently long pasted message.' }, database, interpreter)
    expect(result).toMatchObject({ classification: 'UNCERTAIN', confidenceBand: 'LOW', rawText: 'A malformed but sufficiently long pasted message.' })
    expect(JSON.stringify(result)).not.toContain('private provider detail')
  })

  it('reuses the same owner-scoped intake for a duplicate paste', async () => {
    const { database } = databaseFixture()
    const first = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.ccaRecruitment }, database)
    const second = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.ccaRecruitment }, database)
    expect(second.id).toBe(first.id)
    expect(second.duplicate).toBe(true)
    expect(database.mailIntake.create).toHaveBeenCalledTimes(1)
  })

  it('does not expose another owner’s mail evidence', async () => {
    const { database } = databaseFixture()
    const record = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.ambiguous }, database)
    await expect(getMailIntake('user-2', record.id, database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.mailIntake.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: record.id, userId: 'user-2' } }))
  })

  it('converts an approved proposal through canonical Opportunity persistence', async () => {
    const { database } = databaseFixture()
    const intake = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.internship }, database)
    const result = await convertMailToOpportunity('user-1', intake.id, { expectedUpdatedAt: intake.updatedAt }, database)
    expect(canonical.createOpportunity).toHaveBeenCalledWith('user-1', expect.objectContaining({
      title: 'Summer Analyst Internship', organisation: 'Example Capital', category: 'INTERNSHIP', sourceType: 'EMAIL', sourceName: 'NTU Mail'
    }), database)
    expect(result).toMatchObject({ opportunityId: 'opportunity-1', duplicate: false, intake: { status: 'CONVERTED', rawText: NTU_MAIL_FIXTURES.internship } })
  })

  it('links an approved proposal to an existing canonical duplicate', async () => {
    const { database } = databaseFixture()
    canonical.findOpportunityDuplicates.mockResolvedValue([{ id: 'existing-opportunity' }])
    const intake = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.internship }, database)
    const result = await convertMailToOpportunity('user-1', intake.id, { expectedUpdatedAt: intake.updatedAt }, database)
    expect(result).toMatchObject({ opportunityId: 'existing-opportunity', duplicate: true })
    expect(canonical.createOpportunity).not.toHaveBeenCalled()
  })

  it('uses the existing Task service only after explicit confirmation', async () => {
    const { database } = databaseFixture()
    const intake = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.requiredAdmin }, database)
    const result = await convertMailToTask('user-1', intake.id, { expectedUpdatedAt: intake.updatedAt }, database)
    expect(canonical.createTask).toHaveBeenCalledWith('user-1', expect.objectContaining({ type: 'ADMIN', description: NTU_MAIL_FIXTURES.requiredAdmin }), database)
    expect(result).toMatchObject({ taskId: 'task-1', intake: { status: 'CONVERTED' } })
  })

  it('dismisses or retains a note without creating an opportunity, task, or assessment', async () => {
    const first = databaseFixture()
    const noise = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.newsletter }, first.database)
    await expect(dismissMailIntake('user-1', noise.id, { expectedUpdatedAt: noise.updatedAt }, first.database)).resolves.toMatchObject({ status: 'DISMISSED' })
    const second = databaseFixture()
    const admin = await createMailIntake('user-1', { rawText: NTU_MAIL_FIXTURES.venueChange }, second.database)
    await expect(retainMailAsNote('user-1', admin.id, { expectedUpdatedAt: admin.updatedAt }, second.database)).resolves.toMatchObject({ status: 'REVIEWED' })
    expect(canonical.createOpportunity).not.toHaveBeenCalled()
    expect(canonical.createTask).not.toHaveBeenCalled()
    expect(first.database.assessment.create).not.toHaveBeenCalled()
  })
})
