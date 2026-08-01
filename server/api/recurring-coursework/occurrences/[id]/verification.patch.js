import { getRouterParam } from 'h3'
import { updateSubmissionVerificationSchema } from '#shared/schemas/recurring-coursework'
import { updateSubmissionVerification } from '../../../../services/recurring-coursework'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../../utils/module-request'

export default defineEventHandler(async event => {
  try { const user = await requireModuleUser(event); return await updateSubmissionVerification(user.id, getRouterParam(event, 'id'), await readModuleBody(event, updateSubmissionVerificationSchema)) }
  catch (error) { return handleModuleError(event, error, 'Updating submission verification') }
})
