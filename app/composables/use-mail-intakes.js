export function useMailIntakes() {
  const requestFetch = useRequestFetch()
  const records = useState('northstar-mail-intakes', () => [])
  const loading = useState('northstar-mail-intakes-loading', () => false)
  const saving = useState('northstar-mail-intakes-saving', () => false)
  const error = useState('northstar-mail-intakes-error', () => '')
  const fieldErrors = useState('northstar-mail-intakes-field-errors', () => ({}))
  const notice = useState('northstar-mail-intakes-notice', () => '')
  const clear = () => { error.value = ''; fieldErrors.value = {}; notice.value = '' }

  async function load() {
    loading.value = true; clear()
    try { records.value = await requestFetch('/api/mail-intake'); return records.value }
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
      records.value = [result, ...records.value.filter(item => item.id !== result.id)]
      notice.value = result.duplicate ? 'This email was already in your review history, so the existing intake was reused.' : 'Email structured for review. Nothing else was created.'
    }
    return result
  }
  async function decide(intake, action, extra = {}) {
    const result = await request(`/api/mail-intake/${intake.id}/${action}`, { method: 'POST', body: { expectedUpdatedAt: intake.updatedAt, ...extra } })
    if (result) {
      const updated = result.intake || result
      records.value = records.value.map(item => item.id === updated.id ? updated : item)
      if (action === 'opportunity') notice.value = result.duplicate ? 'Linked to the matching saved Opportunity Radar item.' : 'Saved to Opportunity Radar.'
      if (action === 'task') notice.value = 'Task created.'
      if (action === 'note') notice.value = 'Kept as a reviewed Inbox note.'
      if (action === 'dismiss') notice.value = 'Mail dismissed.'
    }
    return result
  }
  return { records, loading, saving, error, fieldErrors, notice, load, create, decide }
}
