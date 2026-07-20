import { getRouterParam } from 'h3'
import { getModuleDossier } from '../../services/modules'
import { handleModuleError, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    return await getModuleDossier(user.id, getRouterParam(event, 'id'))
  } catch (error) {
    return handleModuleError(event, error, 'Loading a module dossier')
  }
})
