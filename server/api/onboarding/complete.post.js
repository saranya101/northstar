import { completeOnboarding } from '../../services/onboarding'
import { requireAuth } from '../../utils/require-auth'
import { handleOnboardingError } from '../../utils/onboarding-request'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireAuth(event)
    return await completeOnboarding(user.id)
  } catch (error) {
    return handleOnboardingError(event, error, 'Completing onboarding')
  }
})
