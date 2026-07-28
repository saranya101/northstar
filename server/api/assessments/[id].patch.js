import { getRouterParam } from 'h3'
import { updateAssessmentSchema } from '~~/shared/schemas/academic'
import { updateAssessment } from '../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateAssessment(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateAssessmentSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating an assessment') }
})
