import { getOpportunityDiscovery } from '../../services/opportunities'
import { handleOpportunityError, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    return await getOpportunityDiscovery(user.id)
  } catch (error) {
    return handleOpportunityError(event, error, 'Loading Opportunity Radar')
  }
})
