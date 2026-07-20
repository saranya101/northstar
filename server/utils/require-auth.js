import { createError, getRequestHeaders } from 'h3'
import { auth } from './auth'
import { assertAuthenticatedSession } from './session-guard'

export async function requireAuth(event) {
  let session

  try {
    session = await auth.api.getSession({
      headers: new Headers(getRequestHeaders(event))
    })
  } catch {
    console.error('[authentication] Session resolution failed')
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to verify authentication'
    })
  }

  return assertAuthenticatedSession(session)
}
