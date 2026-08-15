export function useMailIntakes() {
  const requestFetch = useRequestFetch()
  const records = useState('northstar-mail-intakes', () => [])
  const loading = useState('northstar-mail-intakes-loading', () => false)
  const saving = useState('northstar-mail-intakes-saving', () => false)
  const error = useState('northstar-mail-intakes-error', () => '')
  const fieldErrors = useState('northstar-mail-intakes-field-errors', () => ({}))
  const notice = useState('northstar-mail-intakes-notice', () => '')
  const view = useState('northstar-mail-intakes-view', () => 'active')
  const clear = () => { error.value = ''; fieldErrors.value = {}; notice.value = '' }

  async function load(nextView = view.value) {
    view.value = nextView
    loading.value = true; clear()
    try { records.value = await requestFetch('/api/mail-intake', { query: { view: view.value } }); return records.value }
    catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load pasted mail.'; return [] }
    finally { loading.value = false }
  }
  async function request(url, options) {
    saving.value = true; clear()
    try { return await requestFetch(url, options) }
    catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to update pasted mail.'; fieldErrors.value = cause?.data?.fieldErrors || {}; return null }
    finally { saving.value = false }
  }
  async function create(body) {
    const result = await request('/api/mail-intake', { method: 'POST', body })
    if (result) {
      view.value = 'active'
      records.value = [result, ...records.value.filter(item => item.id !== result.id)]
      notice.value = result.duplicate ? 'This email was already in your review history, so the existing intake was reused.' : 'Email structured for review. Nothing else was created.'
    }
    return result
  }
  async function preview(body) {
    return request('/api/mail-intake/preview', { method: 'POST', body })
  }
  async function createBatch(messages) {
    const result = await request('/api/mail-intake/batch', { method: 'POST', body: { messages } })
    if (result) {
      const ids = new Set(result.map(item => item.id))
      records.value = [...result, ...records.value.filter(item => !ids.has(item.id))]
      const duplicates = result.filter(item => item.duplicate).length
      notice.value = `${result.length} ${result.length === 1 ? 'email' : 'emails'} structured independently for review.${duplicates ? ` ${duplicates} existing ${duplicates === 1 ? 'intake was' : 'intakes were'} reused.` : ''}`
    }
    return result
  }
  async function decide(intake, action, extra = {}) {
    const result = await request(`/api/mail-intake/${intake.id}/${action}`, { method: 'POST', body: { expectedUpdatedAt: intake.updatedAt, ...extra } })
    if (result) {
      const updated = result.intake || result
      const belongs = view.value === 'active' ? updated.status === 'NEW' : view.value === 'dismissed' ? updated.status === 'DISMISSED' : ['ARCHIVED', 'REVIEWED', 'CONVERTED'].includes(updated.status)
      records.value = belongs ? records.value.map(item => item.id === updated.id ? updated : item) : records.value.filter(item => item.id !== updated.id)
      if (action === 'opportunity') notice.value = result.duplicate ? 'Linked to the matching saved Opportunity Radar item.' : 'Saved to Opportunity Radar.'
      if (action === 'task') notice.value = 'Task created.'
      if (action === 'note') notice.value = 'Kept as a reviewed Inbox note.'
      if (action === 'dismiss') notice.value = 'Mail dismissed.'
      if (action === 'archive') notice.value = 'Mail archived in Northstar.'
    }
    return result
  }
  return { records, view, loading, saving, error, fieldErrors, notice, load, create, preview, createBatch, decide }
}
