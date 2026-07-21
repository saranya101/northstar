import { getRouterParam } from 'h3'
import { updateOpportunitySchema } from '~~/shared/schemas/opportunities'
import { updateOpportunity } from '../../services/opportunities'
import { handleOpportunityError, readOpportunityBody, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await updateOpportunity(user.id, getRouterParam(event, 'id'), await readOpportunityBody(event, updateOpportunitySchema)) }
  catch (error) { return handleOpportunityError(event, error, 'Updating an opportunity') }
})
