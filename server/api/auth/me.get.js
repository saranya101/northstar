import { requireAuth } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireAuth(event)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified
    }
  } catch (error) {
    if (error?.statusCode === 401) {
      setResponseStatus(event, 401)
      return { status: 'unauthorized' }
    }

    setResponseStatus(event, 500)
    return { status: 'unavailable' }
  }
})
