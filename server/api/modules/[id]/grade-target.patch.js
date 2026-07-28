import { getRouterParam } from 'h3'
import { updateGradeTargetSchema } from '~~/shared/schemas/academic'
import { updateGradeTarget } from '../../../services/academic'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'
export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateGradeTarget(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateGradeTargetSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating a grade target') }
})
