import { createTaskSchema } from '#shared/schemas/tasks'
import { createTask } from '../../services/tasks'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'
export default defineEventHandler(async event => { try { const user = await requireModuleUser(event); return await createTask(user.id, await readModuleBody(event, createTaskSchema)) } catch (error) { return handleModuleError(event, error, 'Creating a task') } })
