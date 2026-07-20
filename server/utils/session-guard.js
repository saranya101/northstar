import { createError } from 'h3'

export function assertAuthenticatedSession(session) {
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  return session
}
