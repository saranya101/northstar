import { createError, readBody } from 'h3'

export async function readOnboardingBody(event, schema) {
  const result = schema.safeParse(await readBody(event))

  if (!result.success) {
    const fieldErrors = Object.fromEntries(
      result.error.issues.map(issue => [issue.path.at(-1), issue.message])
    )

    throw createError({
      statusCode: 400,
      statusMessage: 'Please correct the highlighted fields.',
      data: { fieldErrors }
    })
  }

  return result.data
}

export function handleOnboardingError(event, error, operation) {
  const statusCode = error?.statusCode && error.statusCode < 500 ? error.statusCode : 500
  if (statusCode === 500) console.error(`[onboarding] ${operation} failed`)
  setResponseStatus(event, statusCode)
  return {
    status: 'error',
    message: statusCode === 500 ? 'Unable to save onboarding right now.' : error.statusMessage,
    fieldErrors: error?.data?.fieldErrors || {}
  }
}
