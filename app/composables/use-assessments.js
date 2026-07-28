export function useAssessments() {
  const requestFetch = useRequestFetch()
  const records = useState('northstar-assessments', () => ({}))
  const details = useState('northstar-assessment-details', () => ({}))
  const loading = useState('northstar-assessments-loading', () => false)
  const saving = useState('northstar-assessments-saving', () => false)
  const error = useState('northstar-assessments-error', () => '')
  const fieldErrors = useState('northstar-assessments-field-errors', () => ({}))
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
    try { return (records.value[enrolmentId] = await requestFetch(`/api/modules/${enrolmentId}/assessments`)) }
    catch (cause) { error.value = cause?.data?.message || 'Unable to load assessments.'; return null }
    finally { loading.value = false }
  }
  async function loadOne(id, force = false) {
    if (details.value[id] && !force) return details.value[id]
    loading.value = true
    try { return (details.value[id] = await requestFetch(`/api/assessments/${id}`)) }
    catch (cause) { error.value = cause?.data?.message || 'Unable to load the assessment.'; return null }
    finally { loading.value = false }
  }
  async function create(enrolmentId, body) { const result = await request(`/api/modules/${enrolmentId}/assessments`, { method: 'POST', body }, 'Unable to create the assessment.'); if (result) await load(enrolmentId, true); return result }
  async function update(id, body) { const result = await request(`/api/assessments/${id}`, { method: 'PATCH', body }, 'Unable to update the assessment.'); if (result) details.value[id] = result; return result }
  async function remove(id) { const result = await request(`/api/assessments/${id}`, { method: 'DELETE' }, 'Unable to delete the assessment.'); if (result) delete details.value[id]; return result }
  async function setTarget(enrolmentId, body) { const result = await request(`/api/modules/${enrolmentId}/grade-target`, { method: 'PATCH', body }, 'Unable to update the grade target.'); if (result && records.value[enrolmentId]) Object.assign(records.value[enrolmentId], result); return result }
  const child = (id, kind, childId, method, body) => request(`/api/assessments/${id}/${kind}${childId ? `/${childId}` : ''}`, { method, body }, `Unable to update ${kind}.`)
  return {
    records, details, loading, saving, error, fieldErrors, load, loadOne, create, update, remove, setTarget, clearErrors,
    createDeliverable: (id, body) => child(id, 'deliverables', null, 'POST', body),
    updateDeliverable: (id, childId, body) => child(id, 'deliverables', childId, 'PATCH', body),
    deleteDeliverable: (id, childId) => child(id, 'deliverables', childId, 'DELETE'),
    createMilestone: (id, body) => child(id, 'milestones', null, 'POST', body),
    updateMilestone: (id, childId, body) => child(id, 'milestones', childId, 'PATCH', body),
    deleteMilestone: (id, childId) => child(id, 'milestones', childId, 'DELETE')
  }
}
