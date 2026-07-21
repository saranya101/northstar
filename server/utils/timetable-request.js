import { createError, readBody, setResponseStatus } from 'h3'
import { requireAuth } from './require-auth'

export async function requireTimetableUser(event) { return (await requireAuth(event)).user }
export async function readTimetableBody(event, schema) {
  const result = schema.safeParse(await readBody(event))
  if (result.success) return result.data
  throw createError({ statusCode: 400, statusMessage: 'Please correct the highlighted fields.', data: { fieldErrors: Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.') || '_form', issue.message])) } })
}
export function handleTimetableError(event, error, operation) {
  const statusCode = [400, 401, 403, 404, 409].includes(error?.statusCode) ? error.statusCode : 500
  if (statusCode === 500) console.error(`[timetable] ${operation} failed`)
  setResponseStatus(event, statusCode)
  return { status: 'unhealthy', message: statusCode === 500 ? 'Unable to complete the timetable request.' : error.statusMessage, fieldErrors: error?.data?.fieldErrors || {} }
}

