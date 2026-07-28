import {
  scoreOpportunityPortfolioValue,
} from '~~/shared/opportunities/value-intelligence'

export function addPortfolioValue(
  opportunity,
  preferences,
  profile,
  now = new Date(),
) {
  return {
    ...opportunity,
    portfolioValue: scoreOpportunityPortfolioValue(
      opportunity,
      preferences,
      profile,
      now,
    ),
  }
}

export function addPortfolioValueToMany(
  opportunities,
  preferences,
  profile,
  now = new Date(),
) {
  return opportunities.map(opportunity =>
    addPortfolioValue(opportunity, preferences, profile, now),
  )
}
