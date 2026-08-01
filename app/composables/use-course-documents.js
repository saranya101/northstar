const REQUESTS = Symbol.for('northstar.course-document-requests')

function details(cause, fallback) {
  return { message: cause?.data?.message || cause?.statusMessage || fallback, fields: cause?.data?.fieldErrors || {} }
}

export function useCourseDocuments() {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()
  const documents = useState('northstar-course-documents', () => ({}))
  const reviews = useState('northstar-course-document-reviews', () => ({}))
  const loading = useState('northstar-course-documents-loading', () => false)
  const saving = useState('northstar-course-documents-saving', () => false)
  const error = useState('northstar-course-documents-error', () => '')
  nuxtApp[REQUESTS] ||= new Map()

  async function load(enrolmentId, force = false) {
    if (documents.value[enrolmentId] && !force) return documents.value[enrolmentId]
    if (nuxtApp[REQUESTS].has(enrolmentId)) return nuxtApp[REQUESTS].get(enrolmentId)
    loading.value = true
    const request = requestFetch(`/api/modules/${enrolmentId}/course-documents`)
    nuxtApp[REQUESTS].set(enrolmentId, request)
    try { return (documents.value[enrolmentId] = await request) }
    catch (cause) { error.value = details(cause, 'Unable to load course documents.').message; return [] }
    finally { loading.value = false; nuxtApp[REQUESTS].delete(enrolmentId) }
  }

  async function loadOne(id, force = false) {
    if (reviews.value[id] && !force) return reviews.value[id]
    loading.value = true
    try { return (reviews.value[id] = await requestFetch(`/api/course-documents/${id}`)) }
    catch (cause) { error.value = details(cause, 'Unable to load this document review.').message; return null }
    finally { loading.value = false }
  }

  async function mutate(url, options, fallback) {
    saving.value = true; error.value = ''
    try { return await requestFetch(url, options) }
    catch (cause) { error.value = details(cause, fallback).message; return null }
    finally { saving.value = false }
  }

  async function create(enrolmentId, body) {
    const result = await mutate(`/api/modules/${enrolmentId}/course-documents`, { method: 'POST', body }, 'Unable to create the course document.')
    if (result) await load(enrolmentId, true)
    return result
  }

  async function review(id, body) {
    const result = await mutate(`/api/course-documents/${id}/review`, { method: 'POST', body }, 'Unable to save document decisions.')
    if (result) await loadOne(id, true)
    return result
  }

  async function archive(enrolmentId, id) {
    const result = await mutate(`/api/course-documents/${id}/archive`, { method: 'POST' }, 'Unable to archive this document.')
    if (result) await load(enrolmentId, true)
    return result
  }

  return { documents, reviews, loading, saving, error, load, loadOne, create, review, archive }
}
