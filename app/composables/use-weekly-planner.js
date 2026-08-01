import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createPlannerStorage } from '~/utils/planner-storage.client'
import {
  addLocalDays,
  assessmentsForWeek,
  classOccurrencesForWeek,
  focusRouteForBlock,
  formatClockTime,
  localDateFromKey,
  localDateKey,
  startOfLocalWeek,
  studyBlockConflicts,
  summarizeStudyWeek,
  validateStudyBlockInput,
  weekDateKeys,
} from '~~/shared/planner/weekly-planner'

export function useWeeklyPlanner() {
  const { user } = useCurrentSession()
  const { state: moduleState, load: loadModules } = useModules()
  const { state: timetableState, load: loadTimetable } = useTimetable()
  const { records: assessmentRecords, load: loadAssessments } = useAssessments()

  const blocks = ref([])
  const selectedWeekOffset = ref(0)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref('')
  const fieldErrors = ref({})
  const ownerId = ref(null)
  const now = ref(new Date())
  let storage = null
  let remotePromise = null

  const currentWeekStart = computed(() => startOfLocalWeek(now.value))
  const selectedWeekStart = computed(() => addLocalDays(currentWeekStart.value, selectedWeekOffset.value * 7))
  const selectedWeekEnd = computed(() => addLocalDays(selectedWeekStart.value, 6))
  const weekDays = computed(() => weekDateKeys(selectedWeekStart.value))
  const modules = computed(() => moduleState.value?.modules || [])
  const classOccurrences = computed(() => classOccurrencesForWeek(timetableState.value, selectedWeekStart.value))
  const weekBlocks = computed(() => blocks.value
    .filter(block => block.date >= localDateKey(selectedWeekStart.value) && block.date <= localDateKey(selectedWeekEnd.value))
    .sort((left, right) => left.date.localeCompare(right.date) || left.startMinutes - right.startMinutes))
  const summary = computed(() => summarizeStudyWeek(weekBlocks.value))
  const weekAssessments = computed(() => assessmentsForWeek(assessmentRecords.value, modules.value, selectedWeekStart.value))
  const assessmentOptions = computed(() => modules.value.flatMap((module) => {
    const record = assessmentRecords.value[module.enrolmentId]
    return (record?.assessments || []).map(assessment => ({
      id: assessment.id,
      enrolmentId: module.enrolmentId,
      moduleCode: module.code,
      name: assessment.name,
      officialDeadline: assessment.officialDeadline,
      eventDate: assessment.eventDate,
    }))
  }))
  const calendarDays = computed(() => weekDays.value.map(day => ({
    ...day,
    classes: classOccurrences.value.filter(item => item.date === day.dateKey),
    blocks: weekBlocks.value.filter(item => item.date === day.dateKey),
  })))
  const localTimezone = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time')

  function persistResult(result) {
    if (result?.state) blocks.value = result.state.blocks
    fieldErrors.value = result?.errors || {}
    return result
  }

  function loadLocal() {
    if (!storage || !ownerId.value) return
    blocks.value = storage.load(ownerId.value).blocks
  }

  async function loadRemote(force = false) {
    if (!user.value?.id) return null
    if (remotePromise) return remotePromise
    loading.value = true
    error.value = ''
    remotePromise = (async () => {
      try {
        await Promise.all([loadModules(force), loadTimetable(force)])
        await Promise.allSettled(modules.value.map(module => loadAssessments(module.enrolmentId, force)))
      } catch (cause) {
        error.value = cause?.data?.message || cause?.statusMessage || 'Unable to load planner data.'
      } finally {
        loading.value = false
        remotePromise = null
      }
    })()
    return remotePromise
  }

  async function initializeForUser(userId) {
    if (!storage || !userId) return
    ownerId.value = String(userId)
    loadLocal()
    initialized.value = true
    await loadRemote()
  }

  function conflictsForInput(input, id = null) {
    const validation = validateStudyBlockInput(input)
    if (!validation.valid) return { validation, conflicts: [] }
    const candidate = { ...validation.value, id }
    const candidateWeek = startOfLocalWeek(localDateFromKey(candidate.date))
    const classes = classOccurrencesForWeek(timetableState.value, candidateWeek)
    return { validation, conflicts: studyBlockConflicts(candidate, blocks.value, classes, id) }
  }

  function save(input, acknowledgeConflicts = false) {
    fieldErrors.value = {}
    error.value = ''
    if (!storage || !ownerId.value) return { ok: false, errors: { _form: 'Your local planner is still loading.' }, conflicts: [] }
    const check = conflictsForInput(input, input.id || null)
    if (!check.validation.valid) {
      fieldErrors.value = check.validation.errors
      return { ok: false, errors: check.validation.errors, conflicts: [] }
    }
    if (check.conflicts.length && !acknowledgeConflicts) return { ok: false, errors: {}, conflicts: check.conflicts, requiresAcknowledgement: true }

    const module = modules.value.find(item => item.enrolmentId === check.validation.value.enrolmentId)
    const payload = {
      ...check.validation.value,
      moduleCode: module?.code || null,
      moduleTitle: module?.title || null,
      assessmentId: check.validation.value.assessmentId || null,
    }
    const result = input.id ? storage.update(ownerId.value, input.id, payload) : storage.create(ownerId.value, payload)
    persistResult(result)
    return { ok: Boolean(result.block), block: result.block, errors: result.errors, conflicts: check.conflicts }
  }

  function remove(id) {
    if (!storage || !ownerId.value) return false
    const result = storage.remove(ownerId.value, id)
    persistResult(result)
    return result.deleted
  }

  function setStatus(id, status) {
    if (!storage || !ownerId.value) return null
    return persistResult(storage.setStatus(ownerId.value, id, status)).block
  }

  function move(id, patch, acknowledgeConflicts = false) {
    const existing = blocks.value.find(block => block.id === id)
    return existing ? save({ ...existing, ...patch, id }, acknowledgeConflicts) : { ok: false, errors: { id: 'Study block not found.' }, conflicts: [] }
  }

  function clearDraftErrors() {
    fieldErrors.value = {}
  }

  function selectWeek(offset) {
    selectedWeekOffset.value = Math.max(-1, Math.min(1, Number(offset) || 0))
  }

  async function refresh() {
    loadLocal()
    await loadRemote(true)
  }

  function onStorage(event) {
    if (ownerId.value && event.key === storage?.keyForUser(ownerId.value)) loadLocal()
  }

  watch(() => user.value?.id, (id) => {
    if (!storage) return
    if (!id) {
      ownerId.value = null
      blocks.value = []
      initialized.value = false
      return
    }
    if (ownerId.value !== String(id)) void initializeForUser(id)
  })

  onMounted(() => {
    storage = createPlannerStorage(window.localStorage)
    window.addEventListener('storage', onStorage)
    if (user.value?.id) void initializeForUser(user.value.id)
  })

  onActivated(() => {
    if (!user.value?.id || !storage) return
    loadLocal()
    void loadRemote(true)
  })

  onBeforeUnmount(() => window.removeEventListener('storage', onStorage))

  return {
    assessmentOptions,
    blocks,
    calendarDays,
    classOccurrences,
    clearDraftErrors,
    error,
    fieldErrors,
    focusRouteForBlock,
    formatClockTime,
    initialized,
    loading,
    localTimezone,
    modules,
    move,
    refresh,
    remove,
    save,
    selectWeek,
    selectedWeekEnd,
    selectedWeekOffset,
    selectedWeekStart,
    setStatus,
    summary,
    weekAssessments,
    weekBlocks,
  }
}
