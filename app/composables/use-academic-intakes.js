export function useAcademicIntakes() {
  const requestFetch = useRequestFetch()
  const records = useState('northstar-academic-intakes', () => [])
  const loading = useState('northstar-academic-intakes-loading', () => false)
  const saving = useState('northstar-academic-intakes-saving', () => false)
  const error = useState('northstar-academic-intakes-error', () => '')
  const fieldErrors = useState('northstar-academic-intakes-field-errors', () => ({}))
  const clearErrors = () => { error.value = ''; fieldErrors.value = {} }
  async function load() { loading.value = true; clearErrors(); try { records.value = await requestFetch('/api/academic-intakes'); return records.value } catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load Academic Inbox.'; return [] } finally { loading.value = false } }
  async function mutate(url, options) { saving.value = true; clearErrors(); try { return await requestFetch(url, options) } catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to update Academic Inbox.'; fieldErrors.value = cause?.data?.fieldErrors || {}; return null } finally { saving.value = false } }
  async function create(body) { const result = await mutate('/api/academic-intakes', { method: 'POST', body }); if (result) records.value = [result, ...records.value.filter(item => item.id !== result.id)]; return result }
  async function decide(intake, proposal, action) { const result = await mutate(`/api/academic-intakes/${intake.id}/proposals/${proposal.id}/${action}`, { method: 'POST', body: { expectedUpdatedAt: intake.updatedAt } }); if (result) await load(); return result }
  return { records, loading, saving, error, fieldErrors, clearErrors, load, create, approve: (intake, proposal) => decide(intake, proposal, 'approve'), dismiss: (intake, proposal) => decide(intake, proposal, 'dismiss') }
}
