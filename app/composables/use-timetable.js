import { createTimetableImportSchema } from '~~/shared/schemas/timetable'

const TIMETABLE_REQUESTS = Symbol.for('northstar.timetable-requests')

function details(error, fallback) { return { message: error?.data?.message || error?.data?.statusMessage || error?.statusMessage || fallback, fields: error?.data?.fieldErrors || {} } }

function friendlyCandidateIssue(issue, candidate) {
  const [root, moduleIndex, section, field] = issue.path
  if (root === 'modules' && Number.isInteger(moduleIndex) && section === 'examCandidate' && ['startMinutes', 'endMinutes'].includes(field)) {
    const code = candidate?.modules?.[moduleIndex]?.code || 'Module'
    return `${code} exam ${field === 'startMinutes' ? 'start' : 'end'} time was not recognised correctly.`
  }
  return issue.message
}

export function useTimetable() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const { user } = useCurrentSession()
  const { clear: clearModules, load: loadModules } = useModules()
  const state = useState('northstar-timetable', () => null)
  const imports = useState('northstar-timetable-imports', () => ({}))
  const ownerId = useState('northstar-timetable-owner', () => null)
  const pending = useState('northstar-timetable-pending', () => 0)
  const saving = useState('northstar-timetable-saving', () => false)
  const error = useState('northstar-timetable-error', () => '')
  const fieldErrors = useState('northstar-timetable-field-errors', () => ({}))
  const draftCandidate = useState('northstar-timetable-draft-candidate', () => null)
  const loading = computed(() => pending.value > 0)
  nuxtApp[TIMETABLE_REQUESTS] ||= new Map()

  function clearErrors() { error.value = ''; fieldErrors.value = {} }
  function clear() { nuxtApp[TIMETABLE_REQUESTS].clear(); state.value = null; imports.value = {}; draftCandidate.value = null; ownerId.value = null; pending.value = 0; saving.value = false; clearErrors() }
  function currentUser() { const id = user.value?.id || null; if (ownerId.value && ownerId.value !== id) clear(); return id }
  async function request(key, operation) {
    const requests = nuxtApp[TIMETABLE_REQUESTS]
    if (requests.has(key)) return requests.get(key)
    pending.value += 1
    const promise = operation()
    requests.set(key, promise)
    try { return await promise } finally { pending.value = Math.max(0, pending.value - 1); if (requests.get(key) === promise) requests.delete(key) }
  }
  async function load(force = false) {
    const id = currentUser(); if (!id) return null
    if (state.value && ownerId.value === id && !force) return state.value
    clearErrors()
    try { const result = await request('timetable', () => requestFetch('/api/timetable')); if (user.value?.id === id) { state.value = result; ownerId.value = id }; return result } catch (cause) { error.value = details(cause, 'Unable to load your timetable.').message; throw cause }
  }
  async function mutate(url, options, fallback) {
    if (saving.value) return null
    saving.value = true; clearErrors()
    try { return await requestFetch(url, options) } catch (cause) { const value = details(cause, fallback); error.value = value.message; fieldErrors.value = value.fields; return null } finally { saving.value = false }
  }
  async function createImport(body) {
    draftCandidate.value = body
    const parsed = createTimetableImportSchema.safeParse(body)
    if (!parsed.success) {
      error.value = 'Please correct the highlighted timetable fields.'
      fieldErrors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.') || '_form', friendlyCandidateIssue(issue, body)]))
      return null
    }
    const result = await mutate('/api/timetable/imports', { method: 'POST', body: parsed.data }, 'Unable to create the import review.')
    if (result) { imports.value[result.id] = result; draftCandidate.value = null }
    return result
  }
  async function loadImport(id, force = false) { if (imports.value[id] && !force) return imports.value[id]; const result = await request(`import:${id}`, () => requestFetch(`/api/timetable/imports/${id}`)); imports.value[id] = result; return result }
  async function updateImport(id, body) { const result = await mutate(`/api/timetable/imports/${id}`, { method: 'PATCH', body }, 'Unable to save the review.'); if (result) imports.value[id] = result; return result }
  async function confirmImport(id, body) {
    const result = await mutate(`/api/timetable/imports/${id}/confirm`, { method: 'POST', body }, 'Unable to confirm the import.')
    if (result) {
      delete imports.value[id]
      state.value = null
      clearModules()
      await Promise.allSettled([load(true), loadModules(true)])
    }
    return result
  }
  async function cancelImport(id) { const result = await mutate(`/api/timetable/imports/${id}`, { method: 'DELETE' }, 'Unable to cancel the import.'); if (result) delete imports.value[id]; return result }
  async function addSession(enrolmentId, body) { const result = await mutate(`/api/modules/${enrolmentId}/sessions`, { method: 'POST', body }, 'Unable to add the session.'); if (result) await load(true); return result }
  async function updateSession(id, body) { const result = await mutate(`/api/sessions/${id}`, { method: 'PATCH', body }, 'Unable to update the session.'); if (result) await load(true); return result }
  async function deleteSession(id) { const result = await mutate(`/api/sessions/${id}`, { method: 'DELETE' }, 'Unable to delete the session.'); if (result) await load(true); return result }
  async function enrichModule({ code, academicYear, semester, importedTitle }) {
    const query = { code, academicYear, semester }
    if (importedTitle) query.importedTitle = importedTitle
    try { return await request(`enrichment:${code}:${academicYear}:${semester}`, () => requestFetch('/api/timetable/enrichment', { query })) } catch { return { available: false, reason: 'NTU public course information is temporarily unavailable.' } }
  }
  return { state, imports, draftCandidate, loading, saving, error, fieldErrors, load, createImport, loadImport, updateImport, confirmImport, cancelImport, addSession, updateSession, deleteSession, enrichModule, clear, clearErrors }
}
