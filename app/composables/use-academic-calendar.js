import { buildCalendarData } from '#shared/calendar/events'

export function useAcademicCalendar() {
  const { user } = useCurrentSession()
  const modulesApi = useModules()
  const timetableApi = useTimetable()
  const assessmentsApi = useAssessments()

  const loading = ref(false)
  const error = ref('')
  const loadedUserId = ref(null)
  let activeRequest = null

  const data = computed(() => buildCalendarData({
    modules: modulesApi.state.value?.modules || [],
    assessmentRecords: assessmentsApi.records.value,
    timetable: timetableApi.state.value
  }))

  async function load(force = false) {
    const userId = user.value?.id || null
    if (!userId) {
      loadedUserId.value = null
      error.value = ''
      return null
    }
    if (!force && loadedUserId.value === userId && data.value) return data.value
    if (activeRequest) return activeRequest

    loading.value = true
    error.value = ''

    activeRequest = (async () => {
      const [moduleResult, timetableResult] = await Promise.allSettled([
        modulesApi.load(force),
        timetableApi.load(force)
      ])

      const issues = []
      if (moduleResult.status === 'rejected') {
        issues.push(modulesApi.error.value || 'Unable to load modules.')
      }
      if (timetableResult.status === 'rejected') {
        issues.push(timetableApi.error.value || 'Unable to load timetable sessions.')
      }

      const modules = moduleResult.status === 'fulfilled'
        ? moduleResult.value?.modules || []
        : modulesApi.state.value?.modules || []

      let assessmentFailures = 0
      await Promise.all(modules.map(async module => {
        const result = await assessmentsApi.load(module.enrolmentId, force)
        if (!result) assessmentFailures += 1
      }))

      if (assessmentFailures) {
        issues.push(
          assessmentFailures === modules.length
            ? 'Unable to load confirmed assessment dates.'
            : `Unable to load assessment dates for ${assessmentFailures} module${assessmentFailures === 1 ? '' : 's'}.`
        )
      }

      if (user.value?.id === userId) {
        loadedUserId.value = userId
        error.value = [...new Set(issues)].join(' ')
      }

      return data.value
    })()

    try {
      return await activeRequest
    } finally {
      activeRequest = null
      loading.value = false
    }
  }

  watch(
    () => user.value?.id,
    currentUserId => {
      if (!currentUserId) {
        loadedUserId.value = null
        error.value = ''
        return
      }
      void load(currentUserId !== loadedUserId.value)
    },
    { immediate: true }
  )

  return {
    data,
    error,
    loading,
    load,
    refresh: () => load(true)
  }
}
