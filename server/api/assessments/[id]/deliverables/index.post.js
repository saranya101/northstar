import { getRouterParam } from 'h3'
import { createDeliverableSchema } from '~~/shared/schemas/academic'
import { createDeliverable } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createDeliverable(user.id, getRouterParam(event, 'id'), await readModuleBody(event, createDeliverableSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating a deliverable') }
})
