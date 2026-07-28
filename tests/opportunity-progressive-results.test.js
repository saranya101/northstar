import { describe, expect, it } from 'vitest'
import {
  filterAndSortOpportunities,
  OPPORTUNITY_RESULT_PAGE_SIZE,
  opportunityPreview,
  paginateOpportunityResults,
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

describe('Opportunity Radar pagination', () => {
  const results = Array.from({ length: 44 }, (_, index) =>
    item(index + 1),
  )

  it('shows nine results initially with accurate page metadata', () => {
    const page = paginateOpportunityResults(results)

    expect(OPPORTUNITY_RESULT_PAGE_SIZE).toBe(9)
    expect(page.items).toHaveLength(9)
    expect(page.page).toBe(1)
    expect(page.pageCount).toBe(5)
    expect(page.rangeStart).toBe(1)
    expect(page.rangeEnd).toBe(9)
    expect(page.total).toBe(44)
  })

  it('navigates numbered pages without duplicated IDs', () => {
    const pages = Array.from({ length: 5 }, (_, index) =>
      paginateOpportunityResults(results, index + 1),
    )
    const ids = pages.flatMap(page =>
      page.items.map(result => result.id),
    )

    expect(pages[1].items.map(result => result.id))
      .toEqual(results.slice(9, 18).map(result => result.id))
    expect(new Set(ids).size).toBe(44)
    expect(ids).toEqual(results.map(result => result.id))
  })

  it('shows fewer results on the final page and clamps invalid pages', () => {
    const finalPage = paginateOpportunityResults(results, 99)

    expect(finalPage.page).toBe(5)
    expect(finalPage.items).toHaveLength(8)
    expect(finalPage.rangeStart).toBe(37)
    expect(finalPage.rangeEnd).toBe(44)
  })

  it('has one page for nine or fewer results', () => {
    const page = paginateOpportunityResults(results.slice(0, 7), 2)

    expect(page.page).toBe(1)
    expect(page.pageCount).toBe(1)
    expect(page.items).toHaveLength(7)
  })

  it('deduplicates before page boundaries while preserving order', () => {
    const withDuplicates = [
      ...results.slice(0, 10),
      results[0],
      results[1],
    ]
    const first = paginateOpportunityResults(withDuplicates, 1)
    const second = paginateOpportunityResults(withDuplicates, 2)

    expect(first.items).toHaveLength(9)
    expect(second.items).toHaveLength(1)
    expect(new Set([
      ...first.items,
      ...second.items,
    ].map(result => result.id)).size).toBe(10)
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

describe('Opportunity Radar dashboard previews', () => {
  const recommendedPage = [
    item(1),
    item(2),
    item(3),
  ]
  const recommendedIds = new Set(
    recommendedPage.map(result => result.id),
  )

  it('limits closing soon to three and excludes the active page', () => {
    const closing = opportunityPreview(
      [item(1), item(4), item(5), item(6), item(7)],
      recommendedIds,
      3,
    )

    expect(closing.map(result => result.id)).toEqual([4, 5, 6])
  })

  it('limits recently discovered and excludes both earlier sections', () => {
    const closing = [item(4), item(5), item(6)]
    const excluded = new Set([
      ...recommendedIds,
      ...closing.map(result => result.id),
    ])
    const newest = opportunityPreview(
      [item(1), item(4), item(7), item(8), item(9), item(10)],
      excluded,
      3,
    )

    expect(newest.map(result => result.id)).toEqual([7, 8, 9])
  })
})
