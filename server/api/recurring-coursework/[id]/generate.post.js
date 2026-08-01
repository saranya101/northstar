import { getRouterParam } from 'h3'
import { generateRecurringOccurrencesSchema } from '#shared/schemas/recurring-coursework'
import { generateMissingOccurrences } from '../../../services/recurring-coursework'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); const body = await readModuleBody(event, generateRecurringOccurrencesSchema); return await generateMissingOccurrences(user.id, getRouterParam(event, 'id'), body.expectedUpdatedAt) }
  catch (error) { return handleModuleError(event, error, 'Generating recurring coursework occurrences') }
})
