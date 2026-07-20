function moduleErrorDetails(error, fallback) {
  return {
    message: error?.data?.message || error?.data?.statusMessage || error?.statusMessage || fallback,
    fields: error?.data?.fieldErrors || error?.data?.data?.fieldErrors || {}
  }
}

export function useModules() {
  const state = useState('northstar-modules', () => null)
  const dossiers = useState('northstar-module-dossiers', () => ({}))
  const loading = useState('northstar-modules-loading', () => false)
  const saving = useState('northstar-modules-saving', () => false)
  const searching = useState('northstar-modules-searching', () => false)
  const error = useState('northstar-modules-error', () => '')
  const fieldErrors = useState('northstar-modules-field-errors', () => ({}))
  const searchResults = useState('northstar-module-search-results', () => [])
  let loadRequest

  function headers() {
    return import.meta.server ? useRequestHeaders(['cookie']) : undefined
  }

  function clearErrors() {
    error.value = ''
    fieldErrors.value = {}
  }

  async function load(force = false, status = 'ACTIVE') {
    if (state.value && !force && status === 'ACTIVE') return state.value
    if (loadRequest && !force) return loadRequest
    loading.value = true
    clearErrors()
    loadRequest = $fetch('/api/modules', { query: { status }, headers: headers() })
    try {
      const result = await loadRequest
      if (status === 'ACTIVE') state.value = result
      return result
    } catch (cause) {
      error.value = moduleErrorDetails(cause, 'Unable to load modules.').message
      throw cause
    } finally {
      loading.value = false
      loadRequest = null
    }
  }

  async function search(q) {
    clearErrors()
    if (q.trim().length < 2) {
      searchResults.value = []
      return []
    }
    searching.value = true
    try {
      const result = await $fetch('/api/modules/search', { query: { q } })
      searchResults.value = result.results
      return result.results
    } catch (cause) {
      error.value = moduleErrorDetails(cause, 'Unable to search modules.').message
      return []
    } finally {
      searching.value = false
    }
  }

  async function mutate(url, options, fallback) {
    if (saving.value) return null
    saving.value = true
    clearErrors()
    try {
      const result = await $fetch(url, options)
      await load(true)
      return result
    } catch (cause) {
      const details = moduleErrorDetails(cause, fallback)
      error.value = details.message
      fieldErrors.value = details.fields
      return null
    } finally {
      saving.value = false
    }
  }

  const addManual = body => mutate('/api/modules', { method: 'POST', body }, 'Unable to add the module.')
  const enrol = body => mutate('/api/modules/enrol', { method: 'POST', body }, 'Unable to enrol in the module.')

  async function loadDossier(id, force = false) {
    if (dossiers.value[id] && !force) return dossiers.value[id]
    loading.value = true
    clearErrors()
    try {
      dossiers.value[id] = await $fetch(`/api/modules/${id}`, { headers: headers() })
      return dossiers.value[id]
    } catch (cause) {
      error.value = moduleErrorDetails(cause, 'Unable to load the module dossier.').message
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function update(id, body) {
    const result = await mutate(`/api/modules/${id}`, { method: 'PATCH', body }, 'Unable to update the module.')
    if (result) await loadDossier(id, true)
    return result
  }

  async function close(id, mode) {
    const result = await mutate(`/api/modules/${id}`, { method: 'DELETE', query: { mode } }, 'Unable to change the module status.')
    if (result) delete dossiers.value[id]
    return result
  }

  async function addInstructor(id, body) {
    const result = await mutate(`/api/modules/${id}/instructors`, { method: 'POST', body }, 'Unable to add the instructor.')
    if (result) await loadDossier(id, true)
    return result
  }

  return {
    state, dossiers, loading, saving, searching, error, fieldErrors, searchResults,
    load, search, addManual, enrol, loadDossier, update, close, addInstructor, clearErrors
  }
}
