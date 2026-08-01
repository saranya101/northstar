export function useRecurringCoursework() {
  const requestFetch = useRequestFetch()
  const records = useState('northstar-recurring-coursework', () => ({}))
  const details = useState('northstar-recurring-coursework-details', () => ({}))
  const loading = useState('northstar-recurring-coursework-loading', () => false)
  const saving = useState('northstar-recurring-coursework-saving', () => false)
  const error = useState('northstar-recurring-coursework-error', () => '')
  const fieldErrors = useState('northstar-recurring-coursework-field-errors', () => ({}))
  const clearErrors = () => { error.value = ''; fieldErrors.value = {} }

  async function request(url, options, fallback) {
    saving.value = true; clearErrors()
    try { return await requestFetch(url, options) }
    catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || fallback; fieldErrors.value = cause?.data?.fieldErrors || {}; return null }
    finally { saving.value = false }
  }

  async function load(enrolmentId, force = false) {
    if (records.value[enrolmentId] && !force) return records.value[enrolmentId]
    loading.value = true; clearErrors()
    try { return (records.value[enrolmentId] = await requestFetch(`/api/modules/${enrolmentId}/recurring-coursework`)) }
    catch (cause) { error.value = cause?.data?.message || 'Unable to load recurring coursework.'; return [] }
    finally { loading.value = false }
  }

  async function loadOne(id, force = false) {
    if (details.value[id] && !force) return details.value[id]
    loading.value = true; clearErrors()
    try { return (details.value[id] = await requestFetch(`/api/recurring-coursework/${id}`)) }
    catch (cause) { error.value = cause?.data?.message || 'Unable to load recurring coursework.'; return null }
    finally { loading.value = false }
  }

  async function create(enrolmentId, body) { const result = await request(`/api/modules/${enrolmentId}/recurring-coursework`, { method: 'POST', body }, 'Unable to create recurring coursework.'); if (result) await load(enrolmentId, true); return result }
  async function update(id, body) { const result = await request(`/api/recurring-coursework/${id}`, { method: 'PATCH', body }, 'Unable to update recurring coursework.'); if (result) details.value[id] = result; return result }
  async function archive(enrolmentId, id) { const result = await request(`/api/recurring-coursework/${id}/archive`, { method: 'POST' }, 'Unable to archive recurring coursework.'); if (result) await load(enrolmentId, true); return result }
  async function generate(id, expectedUpdatedAt) { const result = await request(`/api/recurring-coursework/${id}/generate`, { method: 'POST', body: { expectedUpdatedAt } }, 'Unable to generate occurrences.'); if (result) details.value[id] = result; return result }
  async function updateOccurrence(requirementId, occurrenceId, body) { const result = await request(`/api/recurring-coursework/occurrences/${occurrenceId}`, { method: 'PATCH', body }, 'Unable to update the occurrence.'); if (result) await loadOne(requirementId, true); return result }
  async function verifyOccurrence(requirementId, occurrenceId, body) { const result = await request(`/api/recurring-coursework/occurrences/${occurrenceId}/verification`, { method: 'PATCH', body }, 'Unable to update submission verification.'); if (result) await loadOne(requirementId, true); return result }

  return { records, details, loading, saving, error, fieldErrors, clearErrors, load, loadOne, create, update, archive, generate, updateOccurrence, verifyOccurrence }
}
