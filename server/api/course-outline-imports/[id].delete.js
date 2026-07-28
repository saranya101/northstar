import { getRouterParam } from 'h3'
import { deleteCourseOutlineImport } from '../../services/academic'
import { handleModuleError, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await deleteCourseOutlineImport(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Deleting a course outline import') }
})
