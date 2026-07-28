import { opportunityPreferencesInputSchema } from '~~/shared/schemas/opportunity-preferences'
import {
  getAvailableOpportunitySources,
  saveOpportunityPreferencesForUser,
} from '../services/opportunity-preferences'
import {
  handleOpportunityError,
  readOpportunityBody,
  requireOpportunityUser,
} from '../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    const input = await readOpportunityBody(
      event,
      opportunityPreferencesInputSchema,
    )
    return {
      ...(await saveOpportunityPreferencesForUser(user.id, input)),
      availableSources: getAvailableOpportunitySources(),
    }
  } catch (error) {
    return handleOpportunityError(event, error, 'Saving Opportunity Radar preferences')
  }
})
