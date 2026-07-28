import { getRouterParam } from 'h3'
import { getAssessment } from '../../services/academic'
import { handleModuleError, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await getAssessment(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Loading an assessment') }
})
