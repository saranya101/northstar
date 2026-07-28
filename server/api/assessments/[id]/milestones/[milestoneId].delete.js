import { getRouterParam } from 'h3'
import { deleteMilestone } from '../../../../services/academic'
import { handleModuleError, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await deleteMilestone(user.id, getRouterParam(event, 'id'), getRouterParam(event, 'milestoneId')) }
  catch (error) { return handleModuleError(event, error, 'Deleting a milestone') }
})
