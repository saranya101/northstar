import { normaliseAuthError } from '~/utils/auth-error'
import { signOut } from '~/utils/auth-client'

export function useAuthActions() {
  const nuxtApp = useNuxtApp()
  const signingOut = ref(false)
  const signOutError = ref('')
  const { clearSession } = useCurrentSession()
  const { clear: clearOnboarding } = useOnboarding()
  const { clear: clearModules } = useModules()
  const { clear: clearTimetable } = useTimetable()

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
      clearModules()
      clearTimetable()
      await nuxtApp.runWithContext(() => navigateTo('/login'))
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
