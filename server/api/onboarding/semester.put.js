import { semesterOnboardingSchema } from '~~/shared/schemas/onboarding'
import { saveSemester } from '../../services/onboarding'
import { requireAuth } from '../../utils/require-auth'
import { handleOnboardingError, readOnboardingBody } from '../../utils/onboarding-request'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireAuth(event)
    const input = await readOnboardingBody(event, semesterOnboardingSchema)
    await saveSemester(user.id, input)
    return { status: 'saved' }
  } catch (error) {
    return handleOnboardingError(event, error, 'Saving semester')
  }
})
