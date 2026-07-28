import {
  opportunityMatchesSource,
} from './opportunity-presentation.js'

export const OPPORTUNITY_RESULT_PAGE_SIZE = 12

const dateValue = (value, fallback) => {
  const timestamp = value ? new Date(value).getTime() : NaN
  return Number.isFinite(timestamp) ? timestamp : fallback
}

export function uniqueOpportunities(items = []) {
  const seen = new Set()

  return items.filter(item => {
    if (!item?.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function filterAndSortOpportunities(
  items = [],
  filters = {},
) {
  const filtered = uniqueOpportunities(items).filter(item =>
    opportunityMatchesSource(item, filters.source)
    && (!filters.category || item.category === filters.category)
    && (!filters.mode || item.mode === filters.mode),
  )

  const indexed = filtered.map((item, index) => ({
    item,
    index,
  }))

  if (!filters.sort || filters.sort === 'RECOMMENDED') {
    return indexed.map(entry => entry.item)
  }

  indexed.sort((left, right) => {
    let difference = 0

    if (filters.sort === 'NEWEST') {
      difference = dateValue(
        right.item.createdAt,
        0,
      ) - dateValue(left.item.createdAt, 0)
    }

    if (filters.sort === 'DEADLINE') {
      difference = dateValue(
        left.item.deadline,
        Number.MAX_SAFE_INTEGER,
      ) - dateValue(
        right.item.deadline,
        Number.MAX_SAFE_INTEGER,
      )
    }

    if (filters.sort === 'PORTFOLIO_VALUE') {
      difference = Number(
        right.item.portfolioValue?.score || 0,
      ) - Number(
        left.item.portfolioValue?.score || 0,
      )
    }

    return difference || left.index - right.index
  })

  return indexed.map(entry => entry.item)
}

export function visibleOpportunityResults(
  items,
  visibleCount,
) {
  return uniqueOpportunities(items)
    .slice(0, Math.max(0, visibleCount))
}
