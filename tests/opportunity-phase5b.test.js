import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { createOpportunity, findOpportunityDuplicates } from '../server/services/opportunities'

const root = new URL('..', import.meta.url).pathname

describe('opportunity duplicate and review behaviour', () => {
  const duplicateRow = { opportunity: { id: 'existing', title: 'Existing role', organisation: 'Example', sourceUrl: 'https://example.org/role', applicationUrl: 'https://example.org/apply' } }

  it('detects only the current user matching normalised source or application URL', async () => {
    const findMany = vi.fn().mockResolvedValue([duplicateRow])
    const database = { userOpportunity: { findMany } }
    const result = await findOpportunityDuplicates('user-1', { sourceUrl: 'https://EXAMPLE.org/role#details', applicationUrl: 'https://example.org/apply#form' }, database)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', opportunity: { OR: [{ sourceUrl: { not: null } }, { applicationUrl: { not: null } }] } } }))
    expect(result[0].id).toBe('existing')
  })

  it('warns before saving and permits a separate record only after explicit confirmation', async () => {
    const transaction = { opportunity: { create: vi.fn().mockResolvedValue({ ...duplicateRow.opportunity, id: 'new', category: 'INTERNSHIP', sourceType: 'PASTED_LINK', mode: 'UNKNOWN', tags: [], createdByUserId: 'user-1', createdAt: new Date(), updatedAt: new Date() }) }, userOpportunity: { create: vi.fn().mockResolvedValue({ id: 'personal', userId: 'user-1', status: 'SAVED' }) } }
    const database = { userOpportunity: { findMany: vi.fn().mockResolvedValue([duplicateRow]) }, $transaction: callback => callback(transaction) }
    const input = { title: 'Role', organisation: 'Example', category: 'INTERNSHIP', sourceUrl: 'https://example.org/role' }
    await expect(createOpportunity('user-1', input, database)).rejects.toMatchObject({ statusCode: 409, data: { duplicates: expect.any(Array) } })
    expect(transaction.opportunity.create).not.toHaveBeenCalled()
    await expect(createOpportunity('user-1', { ...input, allowDuplicate: true }, database)).resolves.toMatchObject({ id: 'new' })
  })

  it('keeps link extraction separate from confirmation and saving', () => {
    const page = readFileSync(join(root, 'app/pages/app/opportunities/new.vue'), 'utf8')
    expect(page).toMatch(/const result = await parseLink\(link\.value\)/)
    expect(page).toMatch(/const result = await create\(form\.value, allowDuplicate\)/)
    expect(page).toContain('Save as separate opportunity')
    expect(page).toContain('rel="noopener noreferrer"')
  })

  it('persists pagination and filters in URL query parameters', () => {
    const page = readFileSync(join(root, 'app/pages/app/opportunities/category/[slug].vue'), 'utf8')
    expect(page).toMatch(/routeFilters\(query\)/)
    expect(page).toMatch(/router\.replace\(\{ query: filterQuery\(filters\) \}\)/)
    expect(page).toMatch(/router\.push\(\{ query: filterQuery\(\{ \.\.\.filters, page \}\) \}\)/)
    expect(page).toContain('Previous')
    expect(page).toContain('Next')
    expect(page).toContain('total result')
  })
})
