const REQUESTS = Symbol.for('northstar.course-outline-requests')

function details(cause, fallback) {
  return { message: cause?.data?.message || cause?.statusMessage || fallback, fields: cause?.data?.fieldErrors || {} }
}

export function useCourseOutlineImports() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const imports = useState('northstar-course-outline-imports', () => ({}))
  const reviews = useState('northstar-course-outline-reviews', () => ({}))
  const loading = useState('northstar-course-outline-loading', () => false)
  const saving = useState('northstar-course-outline-saving', () => false)
  const error = useState('northstar-course-outline-error', () => '')
  const fieldErrors = useState('northstar-course-outline-field-errors', () => ({}))
  nuxtApp[REQUESTS] ||= new Map()

  function clearErrors() { error.value = ''; fieldErrors.value = {} }
  async function load(enrolmentId, force = false) {
    if (imports.value[enrolmentId] && !force) return imports.value[enrolmentId]
    if (nuxtApp[REQUESTS].has(enrolmentId)) return nuxtApp[REQUESTS].get(enrolmentId)
    loading.value = true
    const request = requestFetch(`/api/modules/${enrolmentId}/course-outline-imports`)
    nuxtApp[REQUESTS].set(enrolmentId, request)
    try { return (imports.value[enrolmentId] = await request) }
    catch (cause) { error.value = details(cause, 'Unable to load course outline imports.').message; return [] }
    finally { loading.value = false; nuxtApp[REQUESTS].delete(enrolmentId) }
  }
  async function loadOne(id, force = false) {
    if (reviews.value[id] && !force) return reviews.value[id]
    loading.value = true
    try { return (reviews.value[id] = await requestFetch(`/api/course-outline-imports/${id}`)) }
    catch (cause) { error.value = details(cause, 'Unable to load this review.').message; return null }
    finally { loading.value = false }
  }
  async function mutate(url, options, fallback) {
    saving.value = true; clearErrors()
    try { return await requestFetch(url, options) }
    catch (cause) { const value = details(cause, fallback); error.value = value.message; fieldErrors.value = value.fields; return null }
    finally { saving.value = false }
  }
  async function create(enrolmentId, body) {
    const result = await mutate(`/api/modules/${enrolmentId}/course-outline-imports`, { method: 'POST', body }, 'Unable to create the review.')
    if (result) { reviews.value[result.id] = result; imports.value[enrolmentId] = null }
    return result
  }
  async function update(id, body) {
    const result = await mutate(`/api/course-outline-imports/${id}`, { method: 'PATCH', body }, 'Unable to save the review.')
    if (result) reviews.value[id] = result
    return result
  }
  async function confirm(id, expectedUpdatedAt) {
    return mutate(`/api/course-outline-imports/${id}/confirm`, { method: 'POST', body: { expectedUpdatedAt } }, 'Unable to confirm the course outline.')
  }
  async function cancel(id) { return mutate(`/api/course-outline-imports/${id}/cancel`, { method: 'POST' }, 'Unable to cancel the import.') }
  async function remove(id) { return mutate(`/api/course-outline-imports/${id}`, { method: 'DELETE' }, 'Unable to delete the import.') }
  return { imports, reviews, loading, saving, error, fieldErrors, load, loadOne, create, update, confirm, cancel, remove, clearErrors }
}
