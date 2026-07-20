import { studyPreferenceSchema } from '~~/shared/schemas/onboarding'
import { saveStudyPreference } from '../../services/onboarding'
import { requireAuth } from '../../utils/require-auth'
import { handleOnboardingError, readOnboardingBody } from '../../utils/onboarding-request'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireAuth(event)
    const input = await readOnboardingBody(event, studyPreferenceSchema)
    await saveStudyPreference(user.id, input)
    return { status: 'saved' }
  } catch (error) {
    return handleOnboardingError(event, error, 'Saving study preferences')
  }
})
