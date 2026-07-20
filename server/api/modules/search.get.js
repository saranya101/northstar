import { moduleSearchQuerySchema } from '~~/shared/schemas/modules'
import { searchModules } from '../../services/modules'
import { handleModuleError, readModuleQuery, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const { q } = await readModuleQuery(event, moduleSearchQuerySchema)
    return await searchModules(user.id, q)
  } catch (error) {
    return handleModuleError(event, error, 'Searching modules')
  }
})
