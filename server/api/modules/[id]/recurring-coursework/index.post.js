import { getRouterParam } from 'h3'
import { createRecurringCourseworkSchema } from '#shared/schemas/recurring-coursework'
import { createRecurringCoursework } from '../../../../services/recurring-coursework'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await createRecurringCoursework(user.id, getRouterParam(event, 'id'), await readModuleBody(event, createRecurringCourseworkSchema)) }
  catch (error) { return handleModuleError(event, error, 'Creating recurring coursework') }
})
