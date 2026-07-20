import { getOnboardingState } from '../../services/onboarding'
import { requireAuth } from '../../utils/require-auth'
import { handleOnboardingError } from '../../utils/onboarding-request'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireAuth(event)
    return await getOnboardingState(user.id)
  } catch (error) {
    return handleOnboardingError(event, error, 'Loading state')
  }
})
