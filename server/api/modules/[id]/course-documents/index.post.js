import { getRouterParam } from 'h3'
import { createCourseDocumentSchema } from '#shared/schemas/academic'
import { createCourseDocument } from '../../../../services/course-documents'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createCourseDocument(user.id, getRouterParam(event, 'id'), await readModuleBody(event, createCourseDocumentSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating a course document') }
})
