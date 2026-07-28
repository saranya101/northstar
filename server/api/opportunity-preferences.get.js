import {
  getAvailableOpportunitySources,
  getOpportunityPreferencesForUser,
} from '../services/opportunity-preferences'
import {
  handleOpportunityError,
  requireOpportunityUser,
} from '../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    return {
      ...(await getOpportunityPreferencesForUser(user.id)),
      availableSources: getAvailableOpportunitySources(),
    }
  } catch (error) {
    return handleOpportunityError(event, error, 'Loading Opportunity Radar preferences')
  }
})
