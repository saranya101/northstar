import { getRouterParam } from 'h3'
import { updateRecurringCourseworkSchema } from '#shared/schemas/recurring-coursework'
import { updateRecurringCoursework } from '../../services/recurring-coursework'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateRecurringCoursework(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateRecurringCourseworkSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating recurring coursework') }
})
