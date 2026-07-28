import { getRouterParam } from 'h3'
import { updateDeliverableSchema } from '~~/shared/schemas/academic'
import { updateDeliverable } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateDeliverable(user.id, getRouterParam(event, 'id'), getRouterParam(event, 'deliverableId'), await readModuleBody(event, updateDeliverableSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating a deliverable') }
})
