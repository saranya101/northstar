const SESSION_REQUEST = Symbol.for('northstar.session-request')

export function useCurrentSession() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const state = useState('northstar-auth-session', () => ({
    loaded: false,
    pending: false,
    user: null
  }))
  const error = useState('northstar-auth-session-error', () => '')
  const generation = useState('northstar-auth-session-generation', () => 0)

  const user = computed(() => state.value.user)
  const pending = computed(() => state.value.pending)

  async function loadSession(force = false) {
    if (state.value.loaded && !force) return state.value.user
    if (nuxtApp[SESSION_REQUEST]) return nuxtApp[SESSION_REQUEST]

    const requestGeneration = generation.value
    state.value.pending = true
    error.value = ''

    const request = (async () => {
      try {
        const result = await requestFetch('/api/auth/me')
        if (generation.value === requestGeneration) state.value.user = result
        return result
      } catch (cause) {
        if (generation.value === requestGeneration) {
          state.value.user = null
          error.value = cause?.status === 401 || cause?.statusCode === 401
            ? ''
            : 'Unable to check your session.'
        }
        return null
      } finally {
        if (generation.value === requestGeneration) {
          state.value.loaded = true
          state.value.pending = false
        }
      }
    })()

    nuxtApp[SESSION_REQUEST] = request
    try {
      return await request
    } finally {
      if (nuxtApp[SESSION_REQUEST] === request) delete nuxtApp[SESSION_REQUEST]
    }
  }

  function clearSession() {
    generation.value += 1
    delete nuxtApp[SESSION_REQUEST]
    state.value = {
      loaded: true,
      pending: false,
      user: null
    }
    error.value = ''
  }

  return {
    clearSession,
    ensureLoaded: loadSession,
    error,
    loadSession,
    pending,
    user
  }
}
