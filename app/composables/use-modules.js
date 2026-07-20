const MODULE_LIST_REQUESTS = Symbol.for('northstar.module-list-requests')
const MODULE_DOSSIER_REQUESTS = Symbol.for('northstar.module-dossier-requests')
const MODULE_SEARCH_SEQUENCE = Symbol.for('northstar.module-search-sequence')

function moduleErrorDetails(error, fallback) {
  return {
    message: error?.data?.message || error?.data?.statusMessage || error?.statusMessage || fallback,
    fields: error?.data?.fieldErrors || error?.data?.data?.fieldErrors || {}
  }
}

export function useModules() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const { user } = useCurrentSession()
  const state = useState('northstar-modules', () => null)
  const dossiers = useState('northstar-module-dossiers', () => ({}))
  const ownerId = useState('northstar-modules-owner', () => null)
  const generation = useState('northstar-modules-generation', () => 0)
  const pendingLoads = useState('northstar-modules-pending-loads', () => 0)
  const saving = useState('northstar-modules-saving', () => false)
  const searching = useState('northstar-modules-searching', () => false)
  const error = useState('northstar-modules-error', () => '')
  const fieldErrors = useState('northstar-modules-field-errors', () => ({}))
  const searchResults = useState('northstar-module-search-results', () => [])
  const loading = computed(() => pendingLoads.value > 0)

  nuxtApp[MODULE_LIST_REQUESTS] ||= new Map()
  nuxtApp[MODULE_DOSSIER_REQUESTS] ||= new Map()
  nuxtApp[MODULE_SEARCH_SEQUENCE] ||= 0

  function clearErrors() {
    error.value = ''
    fieldErrors.value = {}
  }

  function clear() {
    generation.value += 1
    nuxtApp[MODULE_LIST_REQUESTS].clear()
    nuxtApp[MODULE_DOSSIER_REQUESTS].clear()
    state.value = null
    dossiers.value = {}
    ownerId.value = null
    pendingLoads.value = 0
    saving.value = false
    searching.value = false
    searchResults.value = []
    clearErrors()
  }

  function matchCurrentUser() {
    const currentUserId = user.value?.id || null
    if (ownerId.value && ownerId.value !== currentUserId) clear()
    return currentUserId
  }

  async function trackedLoad(operation) {
    pendingLoads.value += 1
    try {
      return await operation()
    } finally {
      pendingLoads.value = Math.max(0, pendingLoads.value - 1)
    }
  }

  async function load(force = false, status = 'ACTIVE') {
    const currentUserId = matchCurrentUser()
    if (!currentUserId) return null
    if (state.value && ownerId.value === currentUserId && !force && status === 'ACTIVE') return state.value

    const requests = nuxtApp[MODULE_LIST_REQUESTS]
    if (requests.has(status)) return requests.get(status)
    clearErrors()
    const requestGeneration = generation.value
    const request = trackedLoad(async () => {
      try {
        const result = await requestFetch('/api/modules', { query: { status } })
        if (status === 'ACTIVE' && generation.value === requestGeneration && user.value?.id === currentUserId) {
          state.value = result
          ownerId.value = currentUserId
        }
        return result
      } catch (cause) {
        if (generation.value === requestGeneration) {
          error.value = moduleErrorDetails(cause, 'Unable to load modules.').message
        }
        throw cause
      }
    })

    requests.set(status, request)
    try {
      return await request
    } finally {
      if (requests.get(status) === request) requests.delete(status)
    }
  }

  async function search(q) {
    clearErrors()
    const query = q.trim()
    if (query.length < 2) {
      searchResults.value = []
      return []
    }

    const sequence = ++nuxtApp[MODULE_SEARCH_SEQUENCE]
    searching.value = true
    try {
      const result = await requestFetch('/api/modules/search', { query: { q: query } })
      if (sequence === nuxtApp[MODULE_SEARCH_SEQUENCE]) searchResults.value = result.results
      return result.results
    } catch (cause) {
      if (sequence === nuxtApp[MODULE_SEARCH_SEQUENCE]) {
        error.value = moduleErrorDetails(cause, 'Unable to search modules.').message
      }
      return []
    } finally {
      if (sequence === nuxtApp[MODULE_SEARCH_SEQUENCE]) searching.value = false
    }
  }

  async function mutate(url, options, fallback) {
    if (saving.value) return null
    saving.value = true
    clearErrors()
    try {
      return await requestFetch(url, options)
    } catch (cause) {
      const details = moduleErrorDetails(cause, fallback)
      error.value = details.message
      fieldErrors.value = details.fields
      return null
    } finally {
      saving.value = false
    }
  }

  function addSummary(summary) {
    if (!state.value || summary.status !== 'ACTIVE') return
    const existingIndex = state.value.modules.findIndex(item => item.enrolmentId === summary.enrolmentId)
    if (existingIndex === -1) state.value.modules.push(summary)
    else state.value.modules[existingIndex] = summary
    state.value.modules.sort((left, right) => left.code.localeCompare(right.code))
    state.value.activeCount = state.value.modules.length
  }

  async function addManual(body) {
    const result = await mutate('/api/modules', { method: 'POST', body }, 'Unable to add the module.')
    if (result) addSummary(result)
    return result
  }

  async function enrol(body) {
    const result = await mutate('/api/modules/enrol', { method: 'POST', body }, 'Unable to enrol in the module.')
    if (result) addSummary(result)
    return result
  }

  async function loadDossier(id, force = false) {
    const currentUserId = matchCurrentUser()
    if (!currentUserId) return null
    if (dossiers.value[id] && ownerId.value === currentUserId && !force) return dossiers.value[id]

    const requests = nuxtApp[MODULE_DOSSIER_REQUESTS]
    if (requests.has(id)) return requests.get(id)
    clearErrors()
    const requestGeneration = generation.value
    const request = trackedLoad(async () => {
      try {
        const result = await requestFetch(`/api/modules/${id}`)
        if (generation.value === requestGeneration && user.value?.id === currentUserId) {
          dossiers.value[id] = result
          ownerId.value = currentUserId
        }
        return result
      } catch (cause) {
        if (generation.value === requestGeneration) {
          error.value = moduleErrorDetails(cause, 'Unable to load the module dossier.').message
        }
        throw cause
      }
    })

    requests.set(id, request)
    try {
      return await request
    } finally {
      if (requests.get(id) === request) requests.delete(id)
    }
  }

  async function update(id, body) {
    const result = await mutate(`/api/modules/${id}`, { method: 'PATCH', body }, 'Unable to update the module.')
    if (!result) return null
    addSummary(result)
    if (dossiers.value[id]) Object.assign(dossiers.value[id].enrolment, body, { updatedAt: result.updatedAt })
    return result
  }

  async function close(id, mode) {
    const result = await mutate(`/api/modules/${id}`, { method: 'DELETE', query: { mode } }, 'Unable to change the module status.')
    if (!result) return null
    if (state.value) {
      state.value.modules = state.value.modules.filter(item => item.enrolmentId !== id)
      state.value.activeCount = state.value.modules.length
    }
    delete dossiers.value[id]
    return result
  }

  async function addInstructor(id, body) {
    const result = await mutate(`/api/modules/${id}/instructors`, { method: 'POST', body }, 'Unable to add the instructor.')
    if (!result) return null
    if (dossiers.value[id]) dossiers.value[id].instructors = result.instructors
    const summary = state.value?.modules.find(item => item.enrolmentId === id)
    if (summary) summary.instructors = result.instructors
    return result
  }

  return {
    state,
    dossiers,
    loading,
    saving,
    searching,
    error,
    fieldErrors,
    searchResults,
    load,
    search,
    addManual,
    enrol,
    loadDossier,
    update,
    close,
    addInstructor,
    clear,
    clearErrors
  }
}
