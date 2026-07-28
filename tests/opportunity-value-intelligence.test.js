import { describe, expect, it } from 'vitest'
import {
  OPPORTUNITY_VALUE_VERSION,
  scoreOpportunityPortfolioValue,
} from '../shared/opportunities/value-intelligence.js'

const NOW = new Date('2026-07-28T08:00:00.000Z')
const preferences = {
  portfolioGoals: ['TECHNICAL_SKILLS', 'LEADERSHIP', 'COMMUNITY_IMPACT'],
  skillGoals: ['JavaScript', 'Stakeholder communication'],
}

const base = overrides => ({
  id: 'opportunity-1',
  title: 'Student opportunity',
  organisation: 'Trusted organisation',
  category: 'OTHER',
  description: 'Open to university students.',
  sourceUrl: 'https://example.com/opportunity',
  applicationUrl: 'https://example.com/apply',
  deadline: '2026-08-20T08:00:00.000Z',
  startAt: '2026-09-01T08:00:00.000Z',
  location: 'Singapore',
  mode: 'IN_PERSON',
  eligibilityText: 'University students',
  active: true,
  publicSourceNames: ['Trusted source'],
  tags: [],
  ...overrides,
})

describe('opportunity portfolio value intelligence', () => {
  it('is deterministic and versioned', () => {
    const input = base({ category: 'HACKATHON', description: 'Build a JavaScript prototype and submit it.' })
    const first = scoreOpportunityPortfolioValue(input, preferences, {}, NOW)
    expect(first).toEqual(scoreOpportunityPortfolioValue(input, preferences, {}, NOW))
    expect(first.version).toBe(OPPORTUNITY_VALUE_VERSION)
  })

  it('scores an aligned hackathon high with tangible evidence', () => {
    const result = scoreOpportunityPortfolioValue(base({
      category: 'HACKATHON',
      title: 'JavaScript community impact hackathon',
      description: 'Lead a team to build and submit a prototype with measurable impact.',
      requirements: 'Create a project submission and pitch.',
      benefits: 'Industry mentors and feedback.',
    }), preferences, {}, NOW)

    expect(result.level).toBe('HIGH')
    expect(result.skillSignals).toContain('JavaScript')
    expect(result.goalMatches).toContain('Technical skills')
    expect(result.evidenceIdeas.join(' ')).toMatch(/approved project|truthful/i)
  })

  it('keeps ordinary volunteering medium unless ownership or impact is present', () => {
    const ordinary = scoreOpportunityPortfolioValue(base({
      category: 'VOLUNTEERING',
      description: 'Volunteer at a community event and support attendees.',
    }), preferences, {}, NOW)
    const leadership = scoreOpportunityPortfolioValue(base({
      category: 'VOLUNTEERING',
      description: 'Lead and coordinate a volunteer workstream with measurable community impact.',
    }), preferences, {}, NOW)

    expect(ordinary.level).toBe('MEDIUM')
    expect(leadership.score).toBeGreaterThan(ordinary.score)
  })

  it('penalises passive attendance, expiry, and missing information', () => {
    const conference = scoreOpportunityPortfolioValue(base({
      category: 'TALK',
      description: 'Attend a general conference talk.',
    }), preferences, {}, NOW)
    const expired = scoreOpportunityPortfolioValue(base({
      category: 'HACKATHON',
      deadline: '2026-07-01T08:00:00.000Z',
      endAt: '2026-07-03T08:00:00.000Z',
      description: 'Build a JavaScript prototype.',
    }), preferences, {}, NOW)
    const missing = scoreOpportunityPortfolioValue({
      title: 'Unclear event',
      category: 'OTHER',
      active: true,
    }, preferences, {}, NOW)

    expect(conference.level).toBe('LOW')
    expect(expired.score).toBeLessThan(45)
    expect(missing.level).toBe('LOW')
  })

  it('uses honest resume placeholders and never fabricates numbers', () => {
    const result = scoreOpportunityPortfolioValue(base({
      category: 'LEADERSHIP',
      description: 'Lead and coordinate an activity.',
    }), preferences, {}, NOW)

    expect(result.resumeBulletTemplate).toContain('[X')
    expect(result.resumeBulletTemplate).toContain('[truthful measurable outcome]')
    expect(result.resumeBulletTemplate).not.toMatch(/\b\d+\b/)
  })
})
