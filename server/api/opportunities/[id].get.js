import { getRouterParam } from 'h3'
import { getOpportunity } from '../../services/opportunities'
import { handleOpportunityError, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await getOpportunity(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleOpportunityError(event, error, 'Reading an opportunity') }
})
