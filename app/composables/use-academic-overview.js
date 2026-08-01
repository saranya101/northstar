const ACADEMIC_OVERVIEW_REQUESTS = Symbol.for('northstar.academic-overview-requests')

function overviewError(error) {
  return error?.data?.message || error?.data?.statusMessage || error?.statusMessage || 'Unable to load the academic overview.'
}

export function useAcademicOverview() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const { user } = useCurrentSession()
  const state = useState('northstar-academic-overview', () => null)
  const ownerId = useState('northstar-academic-overview-owner', () => null)
  const pending = useState('northstar-academic-overview-pending', () => 0)
  const error = useState('northstar-academic-overview-error', () => '')
  const loading = computed(() => pending.value > 0)

  nuxtApp[ACADEMIC_OVERVIEW_REQUESTS] ||= new Map()

  function clear() {
    nuxtApp[ACADEMIC_OVERVIEW_REQUESTS].clear()
    state.value = null
    ownerId.value = null
    pending.value = 0
    error.value = ''
  }

  function currentUserId() {
    const id = user.value?.id || null
    if (ownerId.value && ownerId.value !== id) clear()
    return id
  }

  async function load(force = false) {
    const id = currentUserId()
    if (!id) return null
    if (state.value && ownerId.value === id && !force) return state.value

    const key = `overview:${id}`
    const requests = nuxtApp[ACADEMIC_OVERVIEW_REQUESTS]
    if (requests.has(key)) return requests.get(key)

    error.value = ''
    pending.value += 1
    const promise = requestFetch('/api/academic-overview')
    requests.set(key, promise)

    try {
      const result = await promise
      if (user.value?.id === id) {
        state.value = result
        ownerId.value = id
      }
      return result
    } catch (cause) {
      if (user.value?.id === id) error.value = overviewError(cause)
      return null
    } finally {
      pending.value = Math.max(0, pending.value - 1)
      if (requests.get(key) === promise) requests.delete(key)
    }
  }

  return { state, loading, error, load, clear }
}
