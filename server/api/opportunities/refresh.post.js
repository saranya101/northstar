import {
  refreshOpportunitiesForUser,
} from '../../services/opportunity-refresh'
import {
  handleOpportunityError,
  requireOpportunityUser,
} from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    return await refreshOpportunitiesForUser(user.id)
  } catch (error) {
    return handleOpportunityError(event, error, 'Refreshing opportunities')
  }
})
