import { enrolExistingModuleSchema } from '~~/shared/schemas/modules'
import { enrolExistingModule } from '../../services/modules'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const input = await readModuleBody(event, enrolExistingModuleSchema)
    return await enrolExistingModule(user.id, input)
  } catch (error) {
    return handleModuleError(event, error, 'Enrolling in a module')
  }
})
