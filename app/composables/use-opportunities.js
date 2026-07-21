function opportunityError(cause, fallback) {
  return { message: cause?.data?.message || cause?.statusMessage || fallback, fields: cause?.data?.fieldErrors || {} }
}

export function useOpportunities() {
  const nuxtApp = useNuxtApp()
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch
  const state = useState('northstar-opportunities', () => null)
  const loading = useState('northstar-opportunities-loading', () => false)
  const saving = useState('northstar-opportunities-saving', () => false)
  const error = useState('northstar-opportunities-error', () => '')
  const fieldErrors = useState('northstar-opportunities-field-errors', () => ({}))
  const details = useState('northstar-opportunity-details', () => ({}))

  function clearErrors() { error.value = ''; fieldErrors.value = {} }
  async function load(query = {}) {
    loading.value = true; clearErrors()
    try { state.value = await requestFetch('/api/opportunities', { query }); return state.value }
    catch (cause) { error.value = opportunityError(cause, 'Unable to load opportunities.').message; return null }
    finally { loading.value = false }
  }
  async function loadOne(id, force = false) {
    if (details.value[id] && !force) return details.value[id]
    loading.value = true; clearErrors()
    try { details.value[id] = await requestFetch(`/api/opportunities/${id}`); return details.value[id] }
    catch (cause) { error.value = opportunityError(cause, 'Unable to load the opportunity.').message; return null }
    finally { loading.value = false }
  }
  async function mutate(url, options, fallback) {
    saving.value = true; clearErrors()
    try { return await requestFetch(url, options) }
    catch (cause) { const result = opportunityError(cause, fallback); error.value = result.message; fieldErrors.value = result.fields; return null }
    finally { saving.value = false }
  }
  async function create(body) { const result = await mutate('/api/opportunities', { method: 'POST', body }, 'Unable to save the opportunity.'); if (result) details.value[result.id] = result; return result }
  async function update(id, body) { const result = await mutate(`/api/opportunities/${id}`, { method: 'PATCH', body }, 'Unable to update the opportunity.'); if (result) details.value[id] = result; return result }
  async function updateStatus(id, body) { const result = await mutate(`/api/opportunities/${id}/status`, { method: 'PATCH', body }, 'Unable to update your tracking details.'); if (result) details.value[id] = result; return result }
  async function remove(id) { const result = await mutate(`/api/opportunities/${id}`, { method: 'DELETE' }, 'Unable to delete the opportunity.'); if (result) { delete details.value[id]; state.value && (state.value.items = state.value.items.filter(item => item.id !== id)) }; return result }
  async function parseText(text) { return mutate('/api/opportunities/parse-text', { method: 'POST', body: { text } }, 'Unable to extract opportunity details.') }

  return { state, details, loading, saving, error, fieldErrors, load, loadOne, create, update, updateStatus, remove, parseText, clearErrors }
}
