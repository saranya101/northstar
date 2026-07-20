import { moduleListQuerySchema } from '~~/shared/schemas/modules'
import { listModules } from '../../services/modules'
import { handleModuleError, readModuleQuery, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const { status } = await readModuleQuery(event, moduleListQuerySchema)
    return await listModules(user.id, status)
  } catch (error) {
    return handleModuleError(event, error, 'Listing modules')
  }
})
