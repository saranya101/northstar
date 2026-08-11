import { listPreparation } from '../../services/preparation'
import { handleModuleError, requireModuleUser } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try { return await listPreparation((await requireModuleUser(event)).id) }
  catch (error) { return handleModuleError(event, error, 'Listing class preparation') }
})
