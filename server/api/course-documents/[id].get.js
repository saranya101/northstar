import { getRouterParam } from 'h3'
import { getCourseDocument } from '../../services/course-documents'
import { handleModuleError, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await getCourseDocument(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Loading a course document') }
})
