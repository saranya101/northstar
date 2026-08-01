import { getRouterParam } from 'h3'
import { archiveCourseDocument } from '../../../services/course-documents'
import { handleModuleError, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await archiveCourseDocument(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Archiving a course document') }
})
