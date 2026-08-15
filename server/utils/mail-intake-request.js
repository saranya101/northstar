import { createError, readBody } from 'h3'
import { requireAuth } from './require-auth'

export async function requireMailIntakeUser(event) { return (await requireAuth(event)).user }

export async function readMailIntakeBody(event, schema) {
  const result = schema.safeParse(await readBody(event))
  if (result.success) return result.data
  throw createError({
    statusCode: 400,
    statusMessage: 'Please correct the highlighted fields.',
    data: { fieldErrors: Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.') || '_form', issue.message])) }
  })
}
