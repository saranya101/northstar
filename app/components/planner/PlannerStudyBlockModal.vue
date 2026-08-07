<script setup>
import { formatClockTime, localDateKey, parseClockTime, STUDY_BLOCK_STATUSES } from '~~/shared/planner/weekly-planner'

const props = defineProps({
  open: Boolean,
  block: { type: Object, default: null },
  mode: { type: String, default: 'create' },
  defaultDate: { type: String, default: '' },
  modules: { type: Array, default: () => [] },
  assessments: { type: Array, default: () => [] },
  conflicts: { type: Array, default: () => [] },
  fieldErrors: { type: Object, default: () => ({}) },
  prefill: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:open', 'save', 'clear-conflicts', 'delete'])
const form = reactive({ id: null, enrolmentId: '', title: '', date: '', startTime: '09:00', endTime: '10:00', goal: '', status: 'PLANNED', assessmentId: '' })
const acknowledged = ref(false)
const hydrating = ref(false)

const heading = computed(() => props.mode === 'move' ? 'Move study block' : props.block ? 'Edit study block' : 'Add study block')
const description = computed(() => props.mode === 'move' ? 'Choose the new date and time. Northstar will check the slot again.' : 'Study blocks are stored only in this browser for your account.')
const assessmentOptions = computed(() => props.assessments.filter(item => !form.enrolmentId || item.enrolmentId === form.enrolmentId))

function hydrate() {
  if (!props.open) return
  hydrating.value = true
  const source = props.block
  Object.assign(form, source ? {
    id: source.id,
    enrolmentId: source.enrolmentId || '',
    title: source.title,
    date: source.date,
    startTime: formatClockTime(source.startMinutes),
    endTime: formatClockTime(source.endMinutes),
    goal: source.goal || '',
    status: source.status,
    assessmentId: source.assessmentId || '',
  } : {
    id: null,
    enrolmentId: props.prefill.enrolmentId || '',
    title: props.prefill.title || '',
    date: props.defaultDate || localDateKey(new Date()),
    startTime: '09:00',
    endTime: props.prefill.endTime || '10:00',
    goal: props.prefill.goal || '',
    status: 'PLANNED',
    assessmentId: '',
  })
  acknowledged.value = false
  nextTick(() => { hydrating.value = false })
}

watch(() => [props.open, props.block?.id, props.mode, props.defaultDate], hydrate, { immediate: true })
watch(form, () => {
  if (hydrating.value) return
  acknowledged.value = false
  if (props.conflicts.length) emit('clear-conflicts')
}, { deep: true })
watch(() => form.enrolmentId, () => {
  if (form.assessmentId && !assessmentOptions.value.some(item => item.id === form.assessmentId)) form.assessmentId = ''
})

function submit() {
  emit('save', {
    input: {
      id: form.id,
      enrolmentId: form.enrolmentId || null,
      title: form.title,
      date: form.date,
      startMinutes: parseClockTime(form.startTime),
      endMinutes: parseClockTime(form.endTime),
      goal: form.goal || null,
      status: form.status,
      assessmentId: form.assessmentId || null,
    },
    acknowledgeConflicts: acknowledged.value,
  })
}

function conflictTime(item) {
  return `${formatClockTime(item.startMinutes)}–${formatClockTime(item.endMinutes)}`
}
</script>

<template>
  <UModal :open="open" :title="heading" :description="description" :ui="{ content: 'sm:max-w-2xl' }" @update:open="value => emit('update:open', value)">
    <template #body>
      <form id="study-block-form" class="planner-form" @submit.prevent="submit">
        <div v-if="mode !== 'move'" class="planner-form__grid">
          <label class="planner-field" for="planner-module">
            <span>Study type</span>
            <select id="planner-module" v-model="form.enrolmentId">
              <option value="">General study</option>
              <option v-for="module in modules" :key="module.enrolmentId" :value="module.enrolmentId">{{ module.code }} · {{ module.title }}</option>
            </select>
          </label>
          <label class="planner-field" for="planner-status">
            <span>Status</span>
            <select id="planner-status" v-model="form.status"><option v-for="status in STUDY_BLOCK_STATUSES" :key="status" :value="status">{{ status.charAt(0) + status.slice(1).toLowerCase() }}</option></select>
          </label>
        </div>

        <label v-if="mode !== 'move'" class="planner-field" for="planner-title">
          <span>Title</span>
          <input id="planner-title" v-model.trim="form.title" maxlength="160" required placeholder="e.g. Finance tutorial practice">
          <small v-if="fieldErrors.title" class="planner-field__error">{{ fieldErrors.title }}</small>
        </label>

        <div class="planner-form__date-time">
          <label class="planner-field" for="planner-date"><span>Date</span><input id="planner-date" v-model="form.date" type="date" required><small v-if="fieldErrors.date" class="planner-field__error">{{ fieldErrors.date }}</small></label>
          <label class="planner-field" for="planner-start"><span>Start</span><input id="planner-start" v-model="form.startTime" type="time" required><small v-if="fieldErrors.startTime" class="planner-field__error">{{ fieldErrors.startTime }}</small></label>
          <label class="planner-field" for="planner-end"><span>End</span><input id="planner-end" v-model="form.endTime" type="time" required><small v-if="fieldErrors.endTime" class="planner-field__error">{{ fieldErrors.endTime }}</small></label>
        </div>

        <template v-if="mode !== 'move'">
          <label class="planner-field" for="planner-goal"><span>Study goal <em>optional</em></span><textarea id="planner-goal" v-model.trim="form.goal" rows="3" maxlength="500" placeholder="What should be finished by the end of this block?" /></label>
          <label class="planner-field" for="planner-assessment"><span>Related assessment <em>optional</em></span><select id="planner-assessment" v-model="form.assessmentId"><option value="">No related assessment</option><option v-for="assessment in assessmentOptions" :key="assessment.id" :value="assessment.id">{{ assessment.moduleCode }} · {{ assessment.name }}</option></select></label>
        </template>

        <div v-if="conflicts.length" class="planner-conflict" role="alert">
          <div><UIcon name="i-lucide-triangle-alert" /><div><strong>This time overlaps {{ conflicts.length }} existing item{{ conflicts.length === 1 ? '' : 's' }}</strong><p>Northstar will not move anything automatically.</p></div></div>
          <ul><li v-for="item in conflicts" :key="`${item.kind}-${item.id}`"><strong>{{ item.label }}</strong><span>{{ conflictTime(item) }} · {{ item.kind === 'CLASS_SESSION' ? 'Class session' : 'Study block' }}</span></li></ul>
          <label class="planner-conflict__ack"><input v-model="acknowledged" type="checkbox"> Save this block despite the overlap</label>
        </div>
        <p v-if="fieldErrors._form" class="planner-field__error" role="alert">{{ fieldErrors._form }}</p>
      </form>
    </template>
    <template #footer>
      <UButton v-if="block && mode !== 'move'" color="error" variant="soft" @click="emit('delete', block.id)">Delete</UButton>
      <span class="planner-modal-spacer" />
      <UButton color="neutral" variant="outline" @click="emit('update:open', false)">Cancel</UButton>
      <UButton type="submit" form="study-block-form">{{ mode === 'move' ? 'Move block' : 'Save block' }}</UButton>
    </template>
  </UModal>
</template>
