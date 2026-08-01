import { getRouterParam } from 'h3'
import { updateRecurringOccurrenceSchema } from '#shared/schemas/recurring-coursework'
import { updateRecurringOccurrence } from '../../../services/recurring-coursework'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateRecurringOccurrence(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateRecurringOccurrenceSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating a recurring coursework occurrence') }
})
