import { getRouterParam } from 'h3'
import { createInstructorSchema } from '~~/shared/schemas/modules'
import { addModuleInstructor } from '../../../services/modules'
import { handleModuleError, readModuleBody, requireModuleUser } from '../../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireModuleUser(event)
    const input = await readModuleBody(event, createInstructorSchema)
    return await addModuleInstructor(user.id, getRouterParam(event, 'id'), input)
  } catch (error) {
    return handleModuleError(event, error, 'Adding an instructor')
  }
})
