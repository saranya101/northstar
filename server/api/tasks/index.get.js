import { listTasks } from '../../services/tasks'
import { taskListQuerySchema } from '#shared/schemas/tasks'
import { handleModuleError, readModuleQuery, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => { try { const user = await requireModuleUser(event); return await listTasks(user.id, await readModuleQuery(event, taskListQuerySchema)) } catch (error) { return handleModuleError(event, error, 'Listing tasks') } })
