import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))

import {
  createOpportunity,
  deleteOpportunity,
  getOpportunity,
  getOpportunityDiscovery,
  listOpportunities,
  updateOpportunity,
  updateOpportunityStatus,
} from '../server/services/opportunities'


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

describe('opportunity discovery intelligence', () => {
  function makePublicOpportunity(overrides = {}) {
    const id = overrides.id ?? 'public-opportunity'

    return {
      id,
      title: 'General Student Event',
      organisation: 'Example Organisation',
      category: 'OTHER',
      description: null,
      sourceType: 'PUBLIC_SOURCE',
      sourceName: 'Example Source',
      sourceUrl: `https://example.com/${id}`,
      applicationUrl: null,
      publishedAt: null,
      deadline: new Date('2026-07-25T04:00:00.000Z'),
      startAt: null,
      endAt: null,
      location: null,
      mode: 'UNKNOWN',
      commitment: null,
      eligibilityText: null,
      requirements: null,
      benefits: null,
      tags: [],
      createdByUserId: null,
      createdAt: new Date('2026-07-20T04:00:00.000Z'),
      updatedAt: new Date('2026-07-20T04:00:00.000Z'),
      userOpportunities: [],
      sourceListings: [
        {
          id: `listing-${id}`,
          active: true,
          firstSeenAt:
            new Date('2026-07-20T04:00:00.000Z'),
          lastSeenAt:
            new Date('2026-07-21T03:00:00.000Z'),
          lastVerifiedAt:
            new Date('2026-07-21T03:00:00.000Z'),
          source: {
            id: 'source-1',
            name: 'Example Source',
            slug: 'example-source',
          },
        },
      ],
      ...overrides,
    }
  }

  it(
    'adds scoring metadata and a ranked recommended collection without reordering existing previews',
    async () => {
      const lowRelevance = makePublicOpportunity({
        id: 'low-relevance',
      })

      const highRelevance = makePublicOpportunity({
        id: 'high-relevance',
        title: 'Business Case Competition',
        organisation: 'NTU',
        category: 'COMPETITION',
        description:
          'Business students solve an industry challenge and present recommendations to a judging panel.',
        sourceName: 'NTU Events',
        sourceUrl:
          'https://example.com/business-case',
        applicationUrl:
          'https://example.com/business-case/apply',
        location: 'Singapore',
        mode: 'IN_PERSON',
        commitment: 'One-day competition',
        eligibilityText:
          'Open to Year 1 university students',
        requirements:
          'Teams of three to four students',
        benefits: 'Mentorship and prizes',
        tags: ['Business Case', 'Finance'],
        sourceListings: [
          {
            id: 'listing-high',
            active: true,
            firstSeenAt:
              new Date('2026-07-21T00:00:00.000Z'),
            lastSeenAt:
              new Date('2026-07-21T03:00:00.000Z'),
            lastVerifiedAt:
              new Date('2026-07-21T03:00:00.000Z'),
            source: {
              id: 'source-ntu',
              name: 'NTU Events',
              slug: 'ntu-events',
            },
          },
        ],
      })

      const findMany = vi.fn()
        .mockResolvedValueOnce([
          lowRelevance,
          highRelevance,
        ])
        .mockResolvedValueOnce([
          lowRelevance,
          highRelevance,
        ])
        .mockResolvedValueOnce([
          highRelevance,
        ])
        .mockResolvedValueOnce([
          lowRelevance,
          highRelevance,
        ])

      const findAcademicProfile = vi.fn()
        .mockResolvedValue({
          currentYearOfStudy: 1,
          university: {
            name:
              'Nanyang Technological University',
            shortName: 'NTU',
            country: 'Singapore',
          },
          school: {
            name: 'Nanyang Business School',
          },
          programme: {
            name: 'Business',
            degreeType: 'Bachelor',
          },
        })

      const database = {
        opportunity: {
          count: vi.fn().mockResolvedValue(0),
          findMany,
        },
        userAcademicProfile: {
          findUnique: findAcademicProfile,
        },
      }

      const result = await getOpportunityDiscovery(
        'u1',
        database,
        now,
      )

      expect(
        result.closingSoon.map(item => item.id),
      ).toEqual([
        'low-relevance',
        'high-relevance',
      ])

      expect(
        result.newest.map(item => item.id),
      ).toEqual([
        'low-relevance',
        'high-relevance',
      ])

      expect(result.recommended[0].id)
        .toBe('high-relevance')

      expect(
        result.recommended[0].relevanceScore,
      ).toBeGreaterThan(
        result.recommended[1].relevanceScore,
      )

      for (const item of [
        ...result.closingSoon,
        ...result.newest,
        ...result.saved,
        ...result.recommended,
      ]) {
        expect(item).toEqual(
          expect.objectContaining({
            relevanceScore: expect.any(Number),
            scoreBreakdown: expect.any(Object),
            recommendationReasons:
              expect.any(Array),
            rankingVersion:
              'opportunity-ranking-v1',
          }),
        )
      }

      expect(findAcademicProfile)
        .toHaveBeenCalledWith({
          where: {
            userId: 'u1',
          },
          select: {
            currentYearOfStudy: true,
            university: {
              select: {
                name: true,
                shortName: true,
                country: true,
              },
            },
            school: {
              select: {
                name: true,
              },
            },
            programme: {
              select: {
                name: true,
                degreeType: true,
              },
            },
          },
        })
    },
  )
})