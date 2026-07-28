import { getRouterParam } from 'h3'
import { updateMilestoneSchema } from '~~/shared/schemas/academic'
import { updateMilestone } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateMilestone(user.id, getRouterParam(event, 'id'), getRouterParam(event, 'milestoneId'), await readModuleBody(event, updateMilestoneSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating a milestone') }
})
