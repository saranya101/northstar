import { createError, readBody, setResponseStatus } from 'h3'
import { requireAuth } from './require-auth'

export async function requireTimetableUser(event) { return (await requireAuth(event)).user }
function friendlyIssue(issue, body) {
  const [root, moduleIndex, section, field] = issue.path
  if (root === 'modules' && Number.isInteger(moduleIndex) && section === 'examCandidate' && ['startMinutes', 'endMinutes'].includes(field)) {
    const code = body?.modules?.[moduleIndex]?.code || 'Module'
    return `${code} exam ${field === 'startMinutes' ? 'start' : 'end'} time was not recognised correctly.`
  }
  return issue.message
}
export async function readTimetableBody(event, schema) {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (result.success) return result.data
  throw createError({ statusCode: 400, statusMessage: 'Please correct the highlighted fields.', data: { fieldErrors: Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.') || '_form', friendlyIssue(issue, body)])) } })
}
export function handleTimetableError(event, error, operation) {
  const statusCode = [400, 401, 403, 404, 409].includes(error?.statusCode) ? error.statusCode : 500
  if (statusCode === 500) console.error(`[timetable] ${operation} failed`)
  setResponseStatus(event, statusCode)
  return { status: 'unhealthy', message: statusCode === 500 ? 'Unable to complete the timetable request.' : error.statusMessage, fieldErrors: error?.data?.fieldErrors || {} }
}
