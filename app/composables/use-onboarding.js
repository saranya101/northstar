function errorDetails(error, fallback) {
  return {
    message: error?.data?.message || error?.data?.statusMessage || error?.statusMessage || fallback,
    fields: error?.data?.fieldErrors || error?.data?.data?.fieldErrors || {}
  }
}

export function useOnboarding() {
  const state = useState('northstar-onboarding', () => null)
  const loading = useState('northstar-onboarding-loading', () => false)
  const saving = useState('northstar-onboarding-saving', () => false)
  const error = useState('northstar-onboarding-error', () => '')
  const fieldErrors = useState('northstar-onboarding-field-errors', () => ({}))

  async function load(force = false) {
    if (state.value && !force) return state.value
    loading.value = true
    error.value = ''
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      state.value = await $fetch('/api/onboarding', { headers })
      return state.value
    } catch (cause) {
      error.value = errorDetails(cause, 'Unable to load onboarding.').message
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function save(path, body) {
    if (saving.value) return false
    saving.value = true
    error.value = ''
    fieldErrors.value = {}
    try {
      await $fetch(`/api/onboarding/${path}`, { method: 'PUT', body })
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
      const result = await $fetch('/api/onboarding/complete', { method: 'POST' })
      await load(true)
      return result
    } catch (cause) {
      error.value = errorDetails(cause, 'Unable to complete onboarding.').message
      return null
    } finally {
      saving.value = false
    }
  }

  function clearErrors() {
    error.value = ''
    fieldErrors.value = {}
  }

  function clear() {
    state.value = null
    loading.value = false
    saving.value = false
    clearErrors()
  }

  return { state, loading, saving, error, fieldErrors, load, save, complete, clear, clearErrors }
}
