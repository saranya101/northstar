import { getRouterParam } from 'h3'
import { updateCourseOutlineImportSchema } from '~~/shared/schemas/academic'
import { updateCourseOutlineImport } from '../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateCourseOutlineImport(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateCourseOutlineImportSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating a course outline import') }
})
