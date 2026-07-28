import { getRouterParam } from 'h3'
import { listCourseOutlineImports } from '../../../../services/academic'
import { handleModuleError, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await listCourseOutlineImports(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Listing course outline imports') }
})
