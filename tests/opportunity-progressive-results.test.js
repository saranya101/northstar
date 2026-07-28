import { describe, expect, it } from 'vitest'
import {
  filterAndSortOpportunities,
  OPPORTUNITY_RESULT_PAGE_SIZE,
  visibleOpportunityResults,
} from '../app/utils/opportunity-results.js'

const item = (id, overrides = {}) => ({
  id,
  category: 'HACKATHON',
  mode: 'ONLINE',
  publicSourceKeys: ['devpost'],
  createdAt: `2026-07-${String((id % 27) + 1).padStart(2, '0')}T00:00:00.000Z`,
  deadline: `2026-08-${String((id % 27) + 1).padStart(2, '0')}T00:00:00.000Z`,
  portfolioValue: { score: id },
  ...overrides,
})

describe('Opportunity Radar progressive results', () => {
  const results = Array.from({ length: 40 }, (_, index) =>
    item(index + 1),
  )

  it('shows 12 initially and 12 more without duplicates', () => {
    const withDuplicate = [...results, results[0]]
    const initial = visibleOpportunityResults(
      withDuplicate,
      OPPORTUNITY_RESULT_PAGE_SIZE,
    )
    const more = visibleOpportunityResults(
      withDuplicate,
      OPPORTUNITY_RESULT_PAGE_SIZE * 2,
    )

    expect(initial).toHaveLength(12)
    expect(more).toHaveLength(24)
    expect(new Set(more.map(result => result.id)).size).toBe(24)
    expect(more.slice(0, 12)).toEqual(initial)
  })

  it('hides load-more naturally when every result is visible', () => {
    const visible = visibleOpportunityResults(results, 48)
    expect(visible).toHaveLength(40)
    expect(visible.length < results.length).toBe(false)
  })

  it('keeps stable tie ordering while applying temporary filters', () => {
    const tied = [
      item(1, { portfolioValue: { score: 80 } }),
      item(2, { portfolioValue: { score: 80 } }),
      item(3, { portfolioValue: { score: 80 }, mode: 'HYBRID' }),
    ]

    expect(filterAndSortOpportunities(tied, {
      source: 'devpost',
      mode: 'ONLINE',
      sort: 'PORTFOLIO_VALUE',
    }).map(result => result.id)).toEqual([1, 2])
  })

  it('sorts newest, deadline and portfolio value deterministically', () => {
    const mixed = [
      item(1, { createdAt: '2026-07-01T00:00:00.000Z', deadline: null, portfolioValue: { score: 30 } }),
      item(2, { createdAt: '2026-07-03T00:00:00.000Z', deadline: '2026-08-05T00:00:00.000Z', portfolioValue: { score: 90 } }),
      item(3, { createdAt: '2026-07-02T00:00:00.000Z', deadline: '2026-08-01T00:00:00.000Z', portfolioValue: { score: 60 } }),
    ]

    expect(filterAndSortOpportunities(mixed, { sort: 'NEWEST' }).map(result => result.id)).toEqual([2, 3, 1])
    expect(filterAndSortOpportunities(mixed, { sort: 'DEADLINE' }).map(result => result.id)).toEqual([3, 2, 1])
    expect(filterAndSortOpportunities(mixed, { sort: 'PORTFOLIO_VALUE' }).map(result => result.id)).toEqual([2, 3, 1])
  })
})
