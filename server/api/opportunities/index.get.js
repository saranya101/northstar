import { opportunityFiltersSchema } from '~~/shared/schemas/opportunities'
import { listOpportunities } from '../../services/opportunities'
import { handleOpportunityError, readOpportunityQuery, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await listOpportunities(user.id, await readOpportunityQuery(event, opportunityFiltersSchema)) }
  catch (error) { return handleOpportunityError(event, error, 'Listing opportunities') }
})
