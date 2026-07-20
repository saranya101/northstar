import { createError, getQuery, readBody, setResponseStatus } from 'h3'
import { requireAuth } from './require-auth'

function fieldErrors(issues) {
  return Object.fromEntries(issues.map(issue => [issue.path.at(-1) || '_form', issue.message]))
}

async function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please correct the highlighted fields.',
      data: { fieldErrors: fieldErrors(result.error.issues) }
    })
  }
  return result.data
}

export async function requireModuleUser(event) {
  const { user } = await requireAuth(event)
  return user
}

export async function readModuleBody(event, schema) {
  return parse(schema, await readBody(event))
}

export async function readModuleQuery(event, schema) {
  return parse(schema, getQuery(event))
}

export function handleModuleError(event, error, operation) {
  const allowedStatus = [400, 401, 403, 404, 409]
  const statusCode = allowedStatus.includes(error?.statusCode) ? error.statusCode : 500
  if (statusCode === 500) console.error(`[modules] ${operation} failed`)
  setResponseStatus(event, statusCode)
  return {
    status: 'unhealthy',
    message: statusCode === 500 ? 'Unable to complete the module request.' : error.statusMessage,
    fieldErrors: error?.data?.fieldErrors || {}
  }
}
