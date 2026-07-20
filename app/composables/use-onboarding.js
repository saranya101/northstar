const ONBOARDING_REQUEST = Symbol.for('northstar.onboarding-request')

function errorDetails(error, fallback) {
  return {
    message: error?.data?.message || error?.data?.statusMessage || error?.statusMessage || fallback,
    fields: error?.data?.fieldErrors || error?.data?.data?.fieldErrors || {}
  }
}

export function useOnboarding() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const { user } = useCurrentSession()
  const state = useState('northstar-onboarding', () => null)
  const ownerId = useState('northstar-onboarding-owner', () => null)
  const generation = useState('northstar-onboarding-generation', () => 0)
  const loading = useState('northstar-onboarding-loading', () => false)
  const saving = useState('northstar-onboarding-saving', () => false)
  const error = useState('northstar-onboarding-error', () => '')
  const fieldErrors = useState('northstar-onboarding-field-errors', () => ({}))

  function clearErrors() {
    error.value = ''
    fieldErrors.value = {}
  }

  function resetState() {
    generation.value += 1
    delete nuxtApp[ONBOARDING_REQUEST]
    state.value = null
    ownerId.value = null
    loading.value = false
    saving.value = false
    clearErrors()
  }

  function matchCurrentUser() {
    const currentUserId = user.value?.id || null
    if (ownerId.value && ownerId.value !== currentUserId) resetState()
    return currentUserId
  }

  async function load(force = false) {
    const currentUserId = matchCurrentUser()
    if (!currentUserId) return null
    if (state.value && ownerId.value === currentUserId && !force) return state.value
    if (nuxtApp[ONBOARDING_REQUEST]) return nuxtApp[ONBOARDING_REQUEST]

    const requestGeneration = generation.value
    loading.value = true
    error.value = ''

    const request = (async () => {
      try {
        const result = await requestFetch('/api/onboarding')
        if (generation.value === requestGeneration && user.value?.id === currentUserId) {
          state.value = result
          ownerId.value = currentUserId
        }
        return result
      } catch (cause) {
        if (generation.value === requestGeneration) {
          error.value = errorDetails(cause, 'Unable to load onboarding.').message
        }
        throw cause
      } finally {
        if (generation.value === requestGeneration) loading.value = false
      }
    })()

    nuxtApp[ONBOARDING_REQUEST] = request
    try {
      return await request
    } finally {
      if (nuxtApp[ONBOARDING_REQUEST] === request) delete nuxtApp[ONBOARDING_REQUEST]
    }
  }

  async function save(path, body) {
    if (saving.value) return false
    saving.value = true
    clearErrors()
    try {
      await requestFetch(`/api/onboarding/${path}`, { method: 'PUT', body })
      await load(true)
      return true
    } catch (cause) {
      const details = errorDetails(cause, 'Unable to save. Please try again.')
      error.value = details.message
      fieldErrors.value = details.fields
      return false
    } finally {
      saving.value = false
    }
  }

  async function complete() {
    if (saving.value) return null
    saving.value = true
    error.value = ''
    try {
      const result = await requestFetch('/api/onboarding/complete', { method: 'POST' })
      if (state.value) {
        state.value.onboardingCompleted = true
        state.value.onboardingStep = 6
        if (state.value.profile) {
          state.value.profile.onboardingCompleted = true
          state.value.profile.onboardingStep = 6
        }
      }
      return result
    } catch (cause) {
      error.value = errorDetails(cause, 'Unable to complete onboarding.').message
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    state,
    loading,
    saving,
    error,
    fieldErrors,
    load,
    ensureLoaded: load,
    save,
    complete,
    clear: resetState,
    clearErrors
  }
}
