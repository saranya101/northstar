import { getRouterParam } from 'h3'
import { updatePreparationSchema } from '#shared/schemas/preparation'
import { updatePreparation } from '../../../services/preparation'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    return await updatePreparation(user.id, getRouterParam(event, 'enrolmentId'), getRouterParam(event, 'week'), await readModuleBody(event, updatePreparationSchema))
  } catch (error) { return handleModuleError(event, error, 'Updating class preparation') }
})
