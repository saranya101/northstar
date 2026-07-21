import { createOpportunitySchema } from '~~/shared/schemas/opportunities'
import { createOpportunity } from '../../services/opportunities'
import { handleOpportunityError, readOpportunityBody, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try { const user = await requireOpportunityUser(event); return await createOpportunity(user.id, await readOpportunityBody(event, createOpportunitySchema)) }
  catch (error) { return handleOpportunityError(event, error, 'Creating an opportunity') }
})
