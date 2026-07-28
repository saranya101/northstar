function opportunityError(cause, fallback) {
  return { message: cause?.data?.message || cause?.statusMessage || fallback, fields: cause?.data?.fieldErrors || {}, duplicates: cause?.data?.duplicates || [] }
}

export function useOpportunities() {
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch
  const state = useState('northstar-opportunities', () => null)
  const discovery = useState('northstar-opportunity-discovery', () => null)
  const loading = useState('northstar-opportunities-loading', () => false)
  const discoveryLoading = useState('northstar-opportunity-discovery-loading', () => false)
  const saving = useState('northstar-opportunities-saving', () => false)
  const extracting = useState('northstar-opportunities-extracting', () => false)
  const error = useState('northstar-opportunities-error', () => '')
  const fieldErrors = useState('northstar-opportunities-field-errors', () => ({}))
  const details = useState('northstar-opportunity-details', () => ({}))
  const duplicates = useState('northstar-opportunity-duplicates', () => [])
  const refreshing = useState('northstar-opportunities-refreshing', () => false)
  const refreshResult = useState('northstar-opportunities-refresh-result', () => null)
  const refreshError = useState('northstar-opportunities-refresh-error', () => '')

  function clearErrors() { error.value = ''; fieldErrors.value = {}; duplicates.value = [] }

  async function load(query = {}) {
    loading.value = true
    clearErrors()
    try {
      state.value = await requestFetch('/api/opportunities', { query })
      return state.value
    } catch (cause) {
      error.value = opportunityError(cause, 'Unable to load opportunities.').message
      return null
    } finally {
      loading.value = false
    }
  }

  async function loadDiscovery(force = false) {
    if (discovery.value && !force) return discovery.value
    discoveryLoading.value = true
    clearErrors()
    try {
      discovery.value = await requestFetch('/api/opportunities/discovery')
      return discovery.value
    } catch (cause) {
      error.value = opportunityError(cause, 'Unable to load Opportunity Radar.').message
      return null
    } finally {
      discoveryLoading.value = false
    }
  }

  async function loadOne(id, force = false) {
    if (details.value[id] && !force) return details.value[id]
    loading.value = true
    clearErrors()
    try {
      details.value[id] = await requestFetch(`/api/opportunities/${id}`)
      return details.value[id]
    } catch (cause) {
      error.value = opportunityError(cause, 'Unable to load the opportunity.').message
      return null
    } finally {
      loading.value = false
    }
  }

  async function mutate(url, options, fallback) {
    saving.value = true
    clearErrors()
    try {
      return await requestFetch(url, options)
    } catch (cause) {
      const result = opportunityError(cause, fallback)
      error.value = result.message
      fieldErrors.value = result.fields
      duplicates.value = result.duplicates
      return null
    } finally {
      saving.value = false
    }
  }

  async function create(body, allowDuplicate = false) {
    const result = await mutate('/api/opportunities', { method: 'POST', body: { ...body, allowDuplicate } }, 'Unable to save the opportunity.')
    if (result) {
      details.value[result.id] = result
      discovery.value = null
    }
    return result
  }

  async function update(id, body) {
    const result = await mutate(`/api/opportunities/${id}`, { method: 'PATCH', body }, 'Unable to update the opportunity.')
    if (result) {
      details.value[id] = result
      discovery.value = null
    }
    return result
  }

  async function updateStatus(id, body) {
    const result = await mutate(`/api/opportunities/${id}/status`, { method: 'PATCH', body }, 'Unable to update your tracking details.')
    if (result) {
      details.value[id] = result
      discovery.value = null
    }
    return result
  }

  async function remove(id) {
    const result = await mutate(`/api/opportunities/${id}`, { method: 'DELETE' }, 'Unable to delete the opportunity.')
    if (result) {
      delete details.value[id]
      if (state.value) state.value.items = state.value.items.filter(item => item.id !== id)
      discovery.value = null
    }
    return result
  }

  async function parseText(text) {
    return mutate('/api/opportunities/parse-text', { method: 'POST', body: { text } }, 'Unable to extract opportunity details.')
  }

  async function parseLink(url) {
    if (extracting.value) return null
    extracting.value = true
    clearErrors()
    try {
      return await requestFetch('/api/opportunities/parse-link', { method: 'POST', body: { url } })
    } catch (cause) {
      const result = opportunityError(cause, 'Unable to import that webpage.')
      error.value = result.message
      fieldErrors.value = result.fields
      return null
    } finally {
      extracting.value = false
    }
  }

  async function refreshNow() {
    if (refreshing.value) return null
    refreshing.value = true
    refreshError.value = ''
    try {
      refreshResult.value = await requestFetch(
        '/api/opportunities/refresh',
        { method: 'POST' },
      )
      await loadDiscovery(true)
      return refreshResult.value
    } catch (cause) {
      refreshError.value = cause?.data?.message
        || 'Unable to refresh opportunities.'
      refreshResult.value = {
        nextAllowedAt: cause?.data?.nextAllowedAt || null,
      }
      return null
    } finally {
      refreshing.value = false
    }
  }

  return {
    state,
    discovery,
    details,
    loading,
    discoveryLoading,
    saving,
    extracting,
    error,
    fieldErrors,
    duplicates,
    refreshing,
    refreshResult,
    refreshError,
    load,
    loadDiscovery,
    loadOne,
    create,
    update,
    updateStatus,
    remove,
    parseText,
    parseLink,
    refreshNow,
    clearErrors
  }
}
