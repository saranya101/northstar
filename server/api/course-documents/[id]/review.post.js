import { getRouterParam } from 'h3'
import { reviewCourseDocumentSchema } from '#shared/schemas/academic'
import { reviewCourseDocument } from '../../../services/course-documents'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await reviewCourseDocument(user.id, getRouterParam(event, 'id'), await readModuleBody(event, reviewCourseDocumentSchema)) }
  catch (error) { return handleModuleError(event, error, 'Reviewing a course document') }
})
