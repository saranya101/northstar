import { getRouterParam } from 'h3'
import { moduleDeleteQuerySchema } from '~~/shared/schemas/modules'
import { closeModuleEnrolment } from '../../services/modules'
import { handleModuleError, readModuleQuery, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const { mode } = await readModuleQuery(event, moduleDeleteQuerySchema)
    const enrolment = await closeModuleEnrolment(user.id, getRouterParam(event, 'id'), mode)
    return { status: 'saved', enrolment }
  } catch (error) {
    return handleModuleError(event, error, 'Closing a module enrolment')
  }
})
