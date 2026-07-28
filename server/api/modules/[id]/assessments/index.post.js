import { getRouterParam } from 'h3'
import { assessmentInputSchema } from '~~/shared/schemas/academic'
import { createAssessment } from '../../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createAssessment(user.id, getRouterParam(event, 'id'), await readModuleBody(event, assessmentInputSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating an assessment') }
})
