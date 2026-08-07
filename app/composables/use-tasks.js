export function useTasks() {
  const requestFetch = useRequestFetch()
  const tasks = useState('northstar-tasks', () => [])
  const loading = useState('northstar-tasks-loading', () => false)
  const saving = useState('northstar-tasks-saving', () => false)
  const error = useState('northstar-tasks-error', () => '')
  const fieldErrors = useState('northstar-tasks-field-errors', () => ({}))
  const request = async (url, options, fallback) => { saving.value = true; error.value = ''; fieldErrors.value = {}; try { return await requestFetch(url, options) } catch (cause) { error.value = cause?.data?.message || fallback; fieldErrors.value = cause?.data?.fieldErrors || {}; return null } finally { saving.value = false } }
  async function load(query = {}) { loading.value = true; error.value = ''; try { return (tasks.value = await requestFetch('/api/tasks', { query })) } catch (cause) { error.value = cause?.data?.message || 'Unable to load tasks.'; return [] } finally { loading.value = false } }
  async function create(body) { const result = await request('/api/tasks', { method: 'POST', body }, 'Unable to create the task.'); if (result) tasks.value = [result, ...tasks.value]; return result }
  async function update(id, body) { const result = await request(`/api/tasks/${id}`, { method: 'PATCH', body }, 'Unable to update the task.'); if (result) tasks.value = tasks.value.map(item => item.id === id ? result : item); return result }
  async function complete(id, completed) { const result = await request(`/api/tasks/${id}/complete`, { method: 'POST', body: { completed } }, 'Unable to update completion.'); if (result) tasks.value = tasks.value.map(item => item.id === id ? result : item); return result }
  async function remove(id) { const result = await request(`/api/tasks/${id}`, { method: 'DELETE' }, 'Unable to delete the task.'); if (result) tasks.value = tasks.value.filter(item => item.id !== id); return result }
  async function createSubtask(id, body) { const result = await request(`/api/tasks/${id}/subtasks`, { method: 'POST', body }, 'Unable to create the subtask.'); if (result) await load(); return result }
  return { tasks, loading, saving, error, fieldErrors, load, create, update, complete, remove, createSubtask }
}
