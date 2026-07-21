import { getRouterParam } from 'h3'
import { updateOpportunityStatusSchema } from '~~/shared/schemas/opportunities'
import { updateOpportunityStatus } from '../../../services/opportunities'
import { handleOpportunityError, readOpportunityBody, requireOpportunityUser } from '../../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await updateOpportunityStatus(user.id, getRouterParam(event, 'id'), await readOpportunityBody(event, updateOpportunityStatusSchema)) }
  catch (error) { return handleOpportunityError(event, error, 'Updating opportunity status') }
})
