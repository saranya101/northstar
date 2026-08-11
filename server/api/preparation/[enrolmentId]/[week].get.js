import { getRouterParam } from 'h3'
import { getPreparation } from '../../../services/preparation'
import { handleModuleError, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    return await getPreparation(user.id, getRouterParam(event, 'enrolmentId'), getRouterParam(event, 'week'))
  } catch (error) { return handleModuleError(event, error, 'Loading class preparation') }
})
