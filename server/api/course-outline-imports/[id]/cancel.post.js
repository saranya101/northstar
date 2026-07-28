import { getRouterParam } from 'h3'
import { cancelCourseOutlineImport } from '../../../services/academic'
import { handleModuleError, requireModuleUser } from '../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await cancelCourseOutlineImport(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Cancelling a course outline import') }
})
