import {
  OPPORTUNITY_PREFERENCE_DEFAULTS,
} from '~~/shared/schemas/opportunity-preferences'

const cloneDefaults = () => ({
  ...OPPORTUNITY_PREFERENCE_DEFAULTS,
  preferredSources: [],
  preferredCategories: [],
  preferredModes: [],
  portfolioGoals: [],
  skillGoals: [],
})

export function useOpportunityPreferences() {
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch
  const preferences = useState(
    'northstar-opportunity-preferences',
    () => null,
  )
  const loading = useState(
    'northstar-opportunity-preferences-loading',
    () => false,
  )
  const saving = useState(
    'northstar-opportunity-preferences-saving',
    () => false,
  )
  const error = useState(
    'northstar-opportunity-preferences-error',
    () => '',
  )
  const fieldErrors = useState(
    'northstar-opportunity-preferences-fields',
    () => ({}),
  )

  async function load(force = false) {
    if (preferences.value && !force) return preferences.value
    loading.value = true
    error.value = ''
    try {
      preferences.value = await requestFetch(
        '/api/opportunity-preferences',
      )
      return preferences.value
    } catch (cause) {
      error.value = cause?.data?.message
        || 'Unable to load Opportunity Radar settings.'
      return null
    } finally {
      loading.value = false
    }
  }

  async function save(input) {
    saving.value = true
    error.value = ''
    fieldErrors.value = {}
    try {
      preferences.value = await requestFetch(
        '/api/opportunity-preferences',
        { method: 'PUT', body: input },
      )
      return preferences.value
    } catch (cause) {
      error.value = cause?.data?.message
        || 'Unable to save Opportunity Radar settings.'
      fieldErrors.value = cause?.data?.fieldErrors || {}
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    preferences,
    loading,
    saving,
    error,
    fieldErrors,
    defaults: cloneDefaults,
    load,
    save,
  }
}
