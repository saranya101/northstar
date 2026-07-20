import { createManualModuleSchema } from '~~/shared/schemas/modules'
import { createManualModule } from '../../services/modules'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const input = await readModuleBody(event, createManualModuleSchema)
    return await createManualModule(user.id, input)
  } catch (error) {
    return handleModuleError(event, error, 'Creating a module')
  }
})
