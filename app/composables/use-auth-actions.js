import { normaliseAuthError } from '~/utils/auth-error'
import { signOut } from '~/utils/auth-client'

export function useAuthActions() {
  const signingOut = ref(false)
  const signOutError = ref('')
  const { clearSession } = useCurrentSession()
  const { clear: clearOnboarding } = useOnboarding()

  async function logout() {
    if (signingOut.value) {
      return
    }

    signingOut.value = true
    signOutError.value = ''

    try {
      const { error } = await signOut()

      if (error) {
        signOutError.value = normaliseAuthError(error, 'Unable to sign out. Please try again.')
        return
      }

      clearSession()
      clearOnboarding()
      await navigateTo('/login')
    } catch (error) {
      signOutError.value = normaliseAuthError(error, 'Unable to sign out. Please try again.')
    } finally {
      signingOut.value = false
    }
  }

  return {
    logout,
    signingOut,
    signOutError
  }
}
