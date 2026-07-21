import { getRouterParam } from 'h3'
import { deleteOpportunity } from '../../services/opportunities'
import { handleOpportunityError, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await deleteOpportunity(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleOpportunityError(event, error, 'Deleting an opportunity') }
})
