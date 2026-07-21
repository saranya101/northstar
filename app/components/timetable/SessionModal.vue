<script setup>
import { CLASS_SESSION_TYPES, DAYS_OF_WEEK, SESSION_RECURRENCES } from '~~/shared/schemas/timetable'
import { formatMinutes, parseTime } from '~/utils/timetable-import/timetable-time'

const props = defineProps({ open: Boolean, session: { type: Object, default: null }, enrolments: { type: Array, default: () => [] }, fixedEnrolmentId: { type: String, default: '' } })
const emit = defineEmits(['update:open', 'save', 'delete'])
const form = reactive({ enrolmentId: '', classType: 'LECTURE', groupLabel: 'DEFAULT', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', venue: '', recurrence: 'WEEKLY', weekNumbers: '' })
watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, props.session ? { enrolmentId: props.session.enrolmentId, classType: props.session.classType, groupLabel: props.session.groupLabel, dayOfWeek: props.session.dayOfWeek, startTime: formatMinutes(props.session.startMinutes), endTime: formatMinutes(props.session.endMinutes), venue: props.session.venue || '', recurrence: props.session.recurrence, weekNumbers: props.session.weekNumbers.join(', ') } : { enrolmentId: props.fixedEnrolmentId || props.enrolments[0]?.enrolmentId || '', classType: 'LECTURE', groupLabel: 'DEFAULT', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', venue: '', recurrence: 'WEEKLY', weekNumbers: '' })
}, { immediate: true })
function submit() {
  emit('save', { enrolmentId: form.enrolmentId, classType: form.classType, groupLabel: form.groupLabel || 'DEFAULT', dayOfWeek: form.dayOfWeek, startMinutes: parseTime(form.startTime), endMinutes: parseTime(form.endTime), venue: form.venue || null, recurrence: form.recurrence, weekNumbers: form.recurrence === 'CUSTOM' ? form.weekNumbers.split(/[, ]+/).filter(Boolean).map(Number) : [] })
}
</script>
<template>
  <UModal :open="open" :title="session ? 'Edit class session' : 'Add class session'" description="Recurring sessions are private to your enrolment." @update:open="value => emit('update:open', value)">
    <template #body>
      <form id="session-form" class="module-form" @submit.prevent="submit">
        <div v-if="!fixedEnrolmentId" class="module-field"><label for="session-module">Module</label><select id="session-module" v-model="form.enrolmentId" required><option v-for="item in enrolments" :key="item.enrolmentId" :value="item.enrolmentId">{{ item.code }} · {{ item.title }}</option></select></div>
        <div class="module-form__grid"><div class="module-field"><label for="session-type">Class type</label><select id="session-type" v-model="form.classType"><option v-for="item in CLASS_SESSION_TYPES" :key="item">{{ item }}</option></select></div><div class="module-field"><label for="session-group">Group</label><input id="session-group" v-model.trim="form.groupLabel" maxlength="100"></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="session-day">Day</label><select id="session-day" v-model="form.dayOfWeek"><option v-for="item in DAYS_OF_WEEK" :key="item">{{ item }}</option></select></div><div class="module-field"><label for="session-venue">Venue</label><input id="session-venue" v-model.trim="form.venue" maxlength="200"></div></div>
        <div class="module-form__grid"><div class="module-field"><label for="session-start">Starts</label><input id="session-start" v-model="form.startTime" type="time" required></div><div class="module-field"><label for="session-end">Ends</label><input id="session-end" v-model="form.endTime" type="time" required></div></div>
        <div class="module-field"><label for="session-recurrence">Recurrence</label><select id="session-recurrence" v-model="form.recurrence"><option v-for="item in SESSION_RECURRENCES" :key="item">{{ item }}</option></select></div>
        <div v-if="form.recurrence === 'CUSTOM'" class="module-field"><label for="session-weeks">Week numbers</label><input id="session-weeks" v-model="form.weekNumbers" placeholder="1, 3, 5"></div>
      </form>
    </template>
    <template #footer><UButton v-if="session" color="error" variant="soft" @click="emit('delete', session.id)">Delete</UButton><span class="modal-spacer" /><UButton color="neutral" variant="outline" @click="emit('update:open', false)">Cancel</UButton><UButton type="submit" form="session-form">Save session</UButton></template>
  </UModal>
</template>

