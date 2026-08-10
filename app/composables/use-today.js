import { createPlannerStorage } from '~/utils/planner-storage.client'
import { createFocusStorage } from '~/utils/focus-storage.client'
import { localDateKey } from '#shared/planner/weekly-planner'
import { recommendedTodayAction, todayActionCandidates } from '#shared/academic/today-prioritization'

export function useToday() {
  const requestFetch = useRequestFetch()
  const { user } = useCurrentSession()
  const data = ref(null)
  const plannedBlocks = ref([])
  const focusState = ref({ sessions: [], timer: null })
  const loading = ref(false)
  const error = ref('')
  async function load() {
    if (!user.value?.id) return
    loading.value = true; error.value = ''
    try {
      data.value = await requestFetch('/api/today')
      if (import.meta.client) {
        const id = user.value.id
        plannedBlocks.value = createPlannerStorage(window.localStorage).load(id).blocks.filter(block => block.date === localDateKey(new Date()))
        focusState.value = createFocusStorage(window.localStorage).load(id)
        const candidates = { tasks: data.value.tasks, coursework: data.value.coursework, assessments: data.value.assessments, plannedBlocks: plannedBlocks.value }
        data.value = { ...data.value, recommendation: recommendedTodayAction(candidates), candidates: todayActionCandidates(candidates) }
      }
    } catch (cause) { error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load Today.' } finally { loading.value = false }
  }
  return { data, plannedBlocks, focusState, loading, error, load }
}
