import { describe, expect, it } from 'vitest'
import {
  compareRankedOpportunities,
  OPPORTUNITY_RANKING_VERSION,
  rankOpportunities,
  scoreOpportunity,
} from '../shared/opportunities/ranking.js'

const NOW = new Date('2026-07-21T08:00:00.000Z')

const businessProfile = {
  programmeName: 'Business',
  schoolName: 'Nanyang Business School',
  universityName: 'Nanyang Technological University',
  universityShortName: 'NTU',
  universityCountry: 'Singapore',
  degreeType: 'Bachelor',
  currentYearOfStudy: 1,
}

function makeOpportunity(overrides = {}) {
  return {
    id: 'opportunity-1',
    title: 'Business Case Competition',
    organisation: 'NTU',
    category: 'COMPETITION',
    description:
      'Students solve a real business challenge and present recommendations to an industry panel.',
    sourceType: 'PUBLIC_SOURCE',
    sourceName: 'NTU Events',
    sourceUrl: 'https://example.com/event',
    applicationUrl: 'https://example.com/apply',
    publishedAt: '2026-07-20T08:00:00.000Z',
    deadline: '2026-07-25T12:00:00.000Z',
    startAt: '2026-08-01T01:00:00.000Z',
    endAt: '2026-08-01T09:00:00.000Z',
    location: 'Singapore',
    mode: 'IN_PERSON',
    commitment: 'One-day competition',
    eligibilityText: 'Open to Year 1 university students',
    requirements: 'Teams of three to four students',
    benefits: 'Mentorship and prizes',
    tags: ['Business Case', 'Finance'],
    createdAt: '2026-07-20T08:00:00.000Z',
    firstSeenAt: '2026-07-21T00:00:00.000Z',
    active: true,
    isPublic: true,
    publicSourceNames: ['NTU Events'],
    ...overrides,
  }
}

describe('opportunity relevance scoring', () => {
  it('returns deterministic explainable metadata', () => {
    const opportunity = makeOpportunity()

    const first = scoreOpportunity(
      opportunity,
      businessProfile,
      NOW,
    )

    const second = scoreOpportunity(
      opportunity,
      businessProfile,
      NOW,
    )

    expect(first).toEqual(second)
    expect(first.rankingVersion).toBe(
      OPPORTUNITY_RANKING_VERSION,
    )

    expect(first.relevanceScore).toBeGreaterThan(0)
    expect(first.relevanceScore).toBeLessThanOrEqual(100)

    expect(first.scoreBreakdown).toEqual({
      profileMatch: expect.any(Number),
      categoryMatch: expect.any(Number),
      tagMatch: expect.any(Number),
      deadlineUrgency: expect.any(Number),
      freshness: expect.any(Number),
      modeLocationMatch: expect.any(Number),
      sourceQuality: expect.any(Number),
      informationCompleteness: expect.any(Number),
      penalties: expect.any(Number),
    })
  })

  it('makes component scores add up to the final score', () => {
    const result = scoreOpportunity(
      makeOpportunity(),
      businessProfile,
      NOW,
    )

    const componentTotal = Object.values(
      result.scoreBreakdown,
    ).reduce(
      (total, component) => total + component,
      0,
    )

    expect(result.relevanceScore).toBe(
      Math.min(100, Math.max(0, componentTotal)),
    )
  })

  it('uses academic profile information conservatively', () => {
    const matched = scoreOpportunity(
      makeOpportunity(),
      businessProfile,
      NOW,
    )

    const unrelated = scoreOpportunity(
      makeOpportunity({
        title: 'Advanced Chemical Engineering Research',
        description:
          'A research attachment focused on laboratory chemical processes.',
        category: 'RESEARCH',
        tags: ['Engineering', 'Chemistry'],
        eligibilityText: 'Open to engineering students',
        organisation: 'External Laboratory',
        sourceName: 'Research Portal',
        publicSourceNames: ['Research Portal'],
      }),
      businessProfile,
      NOW,
    )

    expect(matched.scoreBreakdown.profileMatch)
      .toBeGreaterThan(
        unrelated.scoreBreakdown.profileMatch,
      )

    expect(matched.scoreBreakdown.tagMatch)
      .toBeGreaterThan(
        unrelated.scoreBreakdown.tagMatch,
      )
  })

  it('uses neutral profile scores when profile data is unavailable', () => {
    const result = scoreOpportunity(
      makeOpportunity(),
      {},
      NOW,
    )

    expect(result.scoreBreakdown.profileMatch).toBe(0)
    expect(result.scoreBreakdown.categoryMatch).toBe(0)
    expect(result.scoreBreakdown.tagMatch).toBe(0)

    expect(result.relevanceScore).toBeGreaterThanOrEqual(0)
  })

  it('scores deadline urgency using fixed time boundaries', () => {
    const inTwoDays = scoreOpportunity(
      makeOpportunity({
        deadline: '2026-07-23T08:00:00.000Z',
      }),
      {},
      NOW,
    )

    const inSevenDays = scoreOpportunity(
      makeOpportunity({
        deadline: '2026-07-28T08:00:00.000Z',
      }),
      {},
      NOW,
    )

    const inFourteenDays = scoreOpportunity(
      makeOpportunity({
        deadline: '2026-08-04T08:00:00.000Z',
      }),
      {},
      NOW,
    )

    const inThirtyDays = scoreOpportunity(
      makeOpportunity({
        deadline: '2026-08-20T08:00:00.000Z',
      }),
      {},
      NOW,
    )

    const later = scoreOpportunity(
      makeOpportunity({
        deadline: '2026-09-30T08:00:00.000Z',
      }),
      {},
      NOW,
    )

    expect(
      inTwoDays.scoreBreakdown.deadlineUrgency,
    ).toBe(14)

    expect(
      inSevenDays.scoreBreakdown.deadlineUrgency,
    ).toBe(11)

    expect(
      inFourteenDays.scoreBreakdown.deadlineUrgency,
    ).toBe(8)

    expect(
      inThirtyDays.scoreBreakdown.deadlineUrgency,
    ).toBe(4)

    expect(
      later.scoreBreakdown.deadlineUrgency,
    ).toBe(1)
  })

  it('scores freshness from the first discovered date', () => {
    const recentlyDiscovered = scoreOpportunity(
      makeOpportunity({
        firstSeenAt: '2026-07-21T00:00:00.000Z',
      }),
      {},
      NOW,
    )

    const olderOpportunity = scoreOpportunity(
      makeOpportunity({
        firstSeenAt: '2026-06-01T00:00:00.000Z',
      }),
      {},
      NOW,
    )

    expect(
      recentlyDiscovered.scoreBreakdown.freshness,
    ).toBe(10)

    expect(
      olderOpportunity.scoreBreakdown.freshness,
    ).toBe(0)
  })

  it('rewards supported mode and Singapore location information', () => {
    const local = scoreOpportunity(
      makeOpportunity({
        mode: 'IN_PERSON',
        location: 'Singapore',
      }),
      businessProfile,
      NOW,
    )

    const overseas = scoreOpportunity(
      makeOpportunity({
        mode: 'IN_PERSON',
        location: 'London, United Kingdom',
        organisation: 'External Organisation',
        sourceName: 'External Source',
        publicSourceNames: ['External Source'],
      }),
      businessProfile,
      NOW,
    )

    const online = scoreOpportunity(
      makeOpportunity({
        mode: 'ONLINE',
        location: null,
      }),
      businessProfile,
      NOW,
    )

    expect(
      local.scoreBreakdown.modeLocationMatch,
    ).toBe(8)

    expect(
      overseas.scoreBreakdown.modeLocationMatch,
    ).toBe(1)

    expect(
      online.scoreBreakdown.modeLocationMatch,
    ).toBe(8)
  })

  it('penalises expired, inactive and low-information records', () => {
    const healthy = scoreOpportunity(
      makeOpportunity(),
      businessProfile,
      NOW,
    )

    const expired = scoreOpportunity(
      makeOpportunity({
        active: false,
        deadline: '2026-07-01T08:00:00.000Z',
        startAt: '2026-07-01T08:00:00.000Z',
        endAt: '2026-07-02T08:00:00.000Z',
        description: null,
        location: null,
        mode: 'UNKNOWN',
        commitment: null,
        eligibilityText: null,
        requirements: null,
        benefits: null,
        tags: [],
        sourceUrl: null,
        applicationUrl: null,
        sourceName: null,
        publicSourceNames: [],
      }),
      businessProfile,
      NOW,
    )

    expect(expired.scoreBreakdown.penalties).toBe(-35)

    expect(expired.relevanceScore)
      .toBeLessThan(healthy.relevanceScore)

    expect(expired.relevanceScore)
      .toBeGreaterThanOrEqual(0)
  })

  it('generates no more than five reasons in stable priority order', () => {
    const result = scoreOpportunity(
      makeOpportunity(),
      businessProfile,
      NOW,
    )

    expect(result.recommendationReasons.length)
      .toBeLessThanOrEqual(5)

    expect(result.recommendationReasons).toEqual([
      'Matches your Business programme',
      'Closing soon',
      'Recently discovered',
      'In-person in Singapore',
      'Complete application information',
    ])
  })

  it('generates an NTU event reason for NTU learning events', () => {
    const result = scoreOpportunity(
      makeOpportunity({
        title: 'Industry Networking Evening',
        category: 'NETWORKING',
        sourceName: 'NTU Events',
        publicSourceNames: ['NTU Events'],
      }),
      businessProfile,
      NOW,
    )

    expect(result.recommendationReasons)
      .toContain('NTU event')
  })

  it('rejects an invalid injected current time', () => {
    expect(() =>
      scoreOpportunity(
        makeOpportunity(),
        businessProfile,
        new Date('invalid'),
      ),
    ).toThrow('Ranking requires a valid current time.')
  })
})

describe('opportunity ranking order', () => {
  it('orders opportunities by relevance score first', () => {
    const ranked = rankOpportunities(
      [
        makeOpportunity({
          id: 'low',
          title: 'Unrelated Listing',
          description: null,
          category: 'OTHER',
          tags: [],
          sourceUrl: null,
          applicationUrl: null,
          location: null,
          mode: 'UNKNOWN',
        }),
        makeOpportunity({
          id: 'high',
        }),
      ],
      businessProfile,
      NOW,
    )

    expect(ranked[0].id).toBe('high')
    expect(ranked[0].relevanceScore)
      .toBeGreaterThanOrEqual(
        ranked[1].relevanceScore,
      )
  })

  it('uses active state as the first tie-breaker', () => {
    const active = {
      id: 'active',
      relevanceScore: 50,
      active: true,
      deadline: null,
      firstSeenAt: null,
    }

    const inactive = {
      id: 'inactive',
      relevanceScore: 50,
      active: false,
      deadline: null,
      firstSeenAt: null,
    }

    expect(
      [inactive, active]
        .sort(compareRankedOpportunities)
        .map(item => item.id),
    ).toEqual(['active', 'inactive'])
  })

  it('uses deadline, freshness and ID as deterministic tie-breakers', () => {
    const ranked = [
      {
        id: 'c',
        relevanceScore: 50,
        active: true,
        deadline: '2026-07-30T08:00:00.000Z',
        firstSeenAt: '2026-07-20T08:00:00.000Z',
      },
      {
        id: 'b',
        relevanceScore: 50,
        active: true,
        deadline: '2026-07-25T08:00:00.000Z',
        firstSeenAt: '2026-07-20T08:00:00.000Z',
      },
      {
        id: 'a',
        relevanceScore: 50,
        active: true,
        deadline: '2026-07-25T08:00:00.000Z',
        firstSeenAt: '2026-07-21T00:00:00.000Z',
      },
    ].sort(compareRankedOpportunities)

    expect(ranked.map(item => item.id))
      .toEqual(['a', 'b', 'c'])
  })

  it('places missing deadlines after present deadlines', () => {
    const ranked = [
      {
        id: 'without-deadline',
        relevanceScore: 50,
        active: true,
        deadline: null,
        firstSeenAt: null,
      },
      {
        id: 'with-deadline',
        relevanceScore: 50,
        active: true,
        deadline: '2026-08-01T08:00:00.000Z',
        firstSeenAt: null,
      },
    ].sort(compareRankedOpportunities)

    expect(ranked.map(item => item.id)).toEqual([
      'with-deadline',
      'without-deadline',
    ])
  })

  it('does not mutate the original opportunities array', () => {
    const opportunities = [
      makeOpportunity({ id: 'b' }),
      makeOpportunity({ id: 'a' }),
    ]

    const originalOrder = opportunities.map(
      opportunity => opportunity.id,
    )

    const ranked = rankOpportunities(
      opportunities,
      businessProfile,
      NOW,
    )

    expect(opportunities.map(
      opportunity => opportunity.id,
    )).toEqual(originalOrder)

    expect(ranked).not.toBe(opportunities)
  })

  it('rejects non-array ranking input', () => {
    expect(() =>
      rankOpportunities(
        null,
        businessProfile,
        NOW,
      ),
    ).toThrow('Opportunities must be an array.')
  })
})
