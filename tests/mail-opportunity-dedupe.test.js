import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { findOpportunityDuplicates } from '../server/services/opportunities.js'

describe('mail opportunity canonical deduplication', () => {
  it('recognises the same owned title, organisation, and exact deadline without requiring a URL', async () => {
    const opportunity = { id: 'opportunity-1', title: 'ASEAN Analytics Competition', organisation: 'Analytics Society', deadline: new Date('2026-10-12T04:00:00.000Z'), sourceUrl: null, applicationUrl: null }
    const database = { userOpportunity: { findMany: vi.fn().mockResolvedValue([{ userId: 'user-1', opportunity }]) } }
    const result = await findOpportunityDuplicates('user-1', { title: opportunity.title, organisation: opportunity.organisation, deadline: opportunity.deadline.toISOString() }, database)
    expect(result).toEqual([expect.objectContaining({ id: 'opportunity-1' })])
    expect(database.userOpportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }))
  })
})
