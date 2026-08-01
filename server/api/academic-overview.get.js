import { getAcademicOverview } from '../services/academic-overview'
import { handleModuleError, requireModuleUser } from '../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    return await getAcademicOverview(user.id)
  } catch (error) {
    return handleModuleError(event, error, 'Loading the academic overview')
  }
})
