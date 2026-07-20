export function useCurrentSession() {
  const state = useState('northstar-auth-session', () => ({
    loaded: false,
    pending: false,
    user: null
  }))

  const user = computed(() => state.value.user)
  const pending = computed(() => state.value.pending)

  async function loadSession(force = false) {
    if (state.value.loaded && !force) {
      return state.value.user
    }

    state.value.pending = true

    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      state.value.user = await $fetch('/api/auth/me', { headers })
    } catch {
      state.value.user = null
    } finally {
      state.value.loaded = true
      state.value.pending = false
    }

    return state.value.user
  }

  function clearSession() {
    state.value = {
      loaded: true,
      pending: false,
      user: null
    }
  }

  return {
    clearSession,
    loadSession,
    pending,
    user
  }
}
