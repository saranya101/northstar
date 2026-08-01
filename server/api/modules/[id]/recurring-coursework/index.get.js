import { getRouterParam } from 'h3'
import { listRecurringCoursework } from '../../../../services/recurring-coursework'
import { handleModuleError, requireModuleUser } from '../../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await listRecurringCoursework(user.id, getRouterParam(event, 'id')) }
  catch (error) { return handleModuleError(event, error, 'Loading recurring coursework') }
})
