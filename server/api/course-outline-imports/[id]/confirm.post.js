import { getRouterParam } from 'h3'
import { confirmCourseOutlineImportSchema } from '~~/shared/schemas/academic'
import { confirmCourseOutlineImport } from '../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await confirmCourseOutlineImport(user.id, getRouterParam(event, 'id'), await readModuleBody(event, confirmCourseOutlineImportSchema)) }
  catch (error) { return handleModuleError(event, error, 'Confirming a course outline import') }
})
