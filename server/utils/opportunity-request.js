import { createError, getQuery, readBody, setResponseStatus } from 'h3'
import { requireAuth } from './require-auth'

function fieldErrors(issues) {
  return Object.fromEntries(issues.map(issue => [issue.path.at(-1) || '_form', issue.message]))
}

async function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Please correct the highlighted fields.', data: { fieldErrors: fieldErrors(result.error.issues) } })
  return result.data
}

export async function requireOpportunityUser(event) { return (await requireAuth(event)).user }
export async function readOpportunityBody(event, schema) { return parse(schema, await readBody(event)) }
export async function readOpportunityQuery(event, schema) { return parse(schema, getQuery(event)) }

export function handleOpportunityError(event, error, operation) {
  const statusCode = [400, 401, 403, 404, 409].includes(error?.statusCode) ? error.statusCode : 500
  if (statusCode === 500) console.error(`[opportunities] ${operation} failed`)
  setResponseStatus(event, statusCode)
  return { status: 'unhealthy', message: statusCode === 500 ? 'Unable to complete the opportunity request.' : error.statusMessage, fieldErrors: error?.data?.fieldErrors || {} }
}
