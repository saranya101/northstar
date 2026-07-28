import { getRouterParam } from 'h3'
import { deleteDeliverable } from '../../../../services/academic'
import { handleModuleError, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await deleteDeliverable(user.id, getRouterParam(event, 'id'), getRouterParam(event, 'deliverableId')) }
  catch (error) { return handleModuleError(event, error, 'Deleting a deliverable') }
})
