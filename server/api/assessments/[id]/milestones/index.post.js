import { getRouterParam } from 'h3'
import { createMilestoneSchema } from '~~/shared/schemas/academic'
import { createMilestone } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createMilestone(user.id, getRouterParam(event, 'id'), await readModuleBody(event, createMilestoneSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating a milestone') }
})
