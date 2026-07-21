import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { createOpportunity, deleteOpportunity, getOpportunity, listOpportunities, updateOpportunity, updateOpportunityStatus } from '../server/services/opportunities'

const now = new Date('2026-07-21T04:00:00.000Z')
const opportunity = { id: 'o1', title: 'Hackathon', organisation: 'Example', category: 'HACKATHON', sourceType: 'MANUAL', mode: 'ONLINE', tags: [], createdByUserId: 'u1', deadline: new Date('2026-07-18T00:00:00.000Z'), startAt: null, endAt: null, createdAt: now, updatedAt: now }
const personal = { id: 'uo1', userId: 'u1', opportunityId: 'o1', status: 'SAVED', savedAt: now, appliedAt: null, personalDeadline: null, notes: null }

describe('opportunity service', () => {
  it('creates a private manual opportunity and its personal record atomically', async () => {
    const transaction = { opportunity: { create: vi.fn().mockResolvedValue(opportunity) }, userOpportunity: { create: vi.fn().mockResolvedValue(personal) } }
    const database = { $transaction: callback => callback(transaction) }
    const result = await createOpportunity('u1', { title: 'Hackathon', organisation: 'Example', category: 'HACKATHON' }, database, now)
    expect(transaction.opportunity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdByUserId: 'u1' }) }))
    expect(transaction.userOpportunity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u1', opportunityId: 'o1', status: 'SAVED', savedAt: now }) })
    expect(result.personal.status).toBe('SAVED')
  })

  it('sets savedAt and appliedAt only when absent', async () => {
    const findOpportunity = vi.fn().mockResolvedValue({ id: 'o1', createdByUserId: 'u1' })
    const findUniquePersonal = vi.fn().mockResolvedValue({ ...personal, savedAt: null, appliedAt: null })
    const upsert = vi.fn().mockResolvedValue({ ...personal, status: 'SAVED', savedAt: now })
    const database = { opportunity: { findFirst: findOpportunity, findUnique: vi.fn().mockResolvedValue(opportunity) }, userOpportunity: { findUnique: findUniquePersonal, upsert } }
    await updateOpportunityStatus('u1', 'o1', { status: 'SAVED' }, database, now)
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ savedAt: now }) }))
    upsert.mockResolvedValue({ ...personal, status: 'APPLIED', appliedAt: now })
    await updateOpportunityStatus('u1', 'o1', { status: 'APPLIED' }, database, now)
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ appliedAt: now }) }))
  })

  it('applies search/category filters and keeps expired opportunities visible', async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...opportunity, userOpportunities: [personal], sourceListings: [] }])
    const database = { opportunity: { findMany, count: vi.fn().mockResolvedValue(1) }, userOpportunity: { count: vi.fn().mockResolvedValue(1) } }
    const result = await listOpportunities('u1', { search: 'hack', category: 'HACKATHON', expired: true, closingSoon: false, upcoming: false, sort: 'deadline', page: 1, pageSize: 20 }, database, now)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ category: 'HACKATHON', deadline: { lt: now } }) }))
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('o1')
  })

  it('isolates private reads, edits and deletes from a second user', async () => {
    const database = { opportunity: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), delete: vi.fn() } }
    await expect(getOpportunity('u2', 'o1', database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(updateOpportunity('u2', 'o1', { title: 'Stolen' }, database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteOpportunity('u2', 'o1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.opportunity.update).not.toHaveBeenCalled()
    expect(database.opportunity.delete).not.toHaveBeenCalled()
    expect(database.opportunity.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1', createdByUserId: 'u2' } }))
  })
})
