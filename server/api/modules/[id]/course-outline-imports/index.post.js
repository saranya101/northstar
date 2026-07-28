import { getRouterParam } from 'h3'
import { createCourseOutlineImportSchema } from '~~/shared/schemas/academic'
import { createCourseOutlineImport } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createCourseOutlineImport(user.id, getRouterParam(event, 'id'), await readModuleBody(event, createCourseOutlineImportSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating a course outline import') }
})
