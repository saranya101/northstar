import { getRouterParam } from 'h3'
import { updateModuleEnrolmentSchema } from '~~/shared/schemas/modules'
import { updateModuleEnrolment } from '../../services/modules'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const input = await readModuleBody(event, updateModuleEnrolmentSchema)
    return await updateModuleEnrolment(user.id, getRouterParam(event, 'id'), input)
  } catch (error) {
    return handleModuleError(event, error, 'Updating a module enrolment')
  }
})
