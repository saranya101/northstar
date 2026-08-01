import { getRouterParam } from 'h3'
import { listCourseDocuments } from '../../../../services/course-documents'
import { handleModuleError, requireModuleUser } from '../../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await listCourseDocuments(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Loading course documents') }
})
