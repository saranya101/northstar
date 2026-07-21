<script setup>
import { formatMinutes } from '~/utils/timetable-import/timetable-time'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Timetable · Northstar', description: 'Your recurring weekly class timetable.' })
const { user } = useCurrentSession()
const { state: modules, load: loadModules } = useModules()
const { state, loading, saving, error, load, addSession, updateSession, deleteSession } = useTimetable()
const modalOpen = ref(false)
const selected = ref(null)
const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const dayLabels = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' }
const conflictIds = computed(() => new Set(state.value?.conflicts.flatMap(pair => [pair.firstSessionId, pair.secondSessionId]) || []))
const today = computed(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Singapore' }).format(new Date()).toUpperCase())
watch(user, current => { if (current) { void load().catch(() => {}); void loadModules().catch(() => {}) } }, { immediate: true })
function edit(session) { selected.value = session; modalOpen.value = true }
function add() { selected.value = null; modalOpen.value = true }
async function save(payload) { const { enrolmentId, ...body } = payload; const result = selected.value ? await updateSession(selected.value.id, body) : await addSession(enrolmentId, body); if (result) modalOpen.value = false }
async function remove(id) { if (await deleteSession(id)) modalOpen.value = false }
function gridStyle(session) { return { gridColumn: days.indexOf(session.dayOfWeek) + 2, gridRow: `${session.startMinutes - 478} / ${session.endMinutes - 478}` } }
</script>
<template>
  <main class="app-page timetable-page">
    <header class="app-page__header"><div><p class="app-page__eyebrow">{{ state?.activeSemester?.label || 'Active semester' }}</p><h1>Weekly timetable</h1><span>Your confirmed and manually added recurring class sessions.</span></div><div class="header-actions"><UButton color="neutral" variant="outline" to="/app/timetable/import" icon="i-lucide-upload">Import another</UButton><UButton icon="i-lucide-plus" :disabled="!modules?.modules?.length" @click="add">Add session</UButton></div></header>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <div v-if="!state && loading" class="module-loading" role="status">Loading timetable…</div>
    <section v-else-if="!state?.sessions.length" class="module-empty"><span class="module-empty__icon"><UIcon name="i-lucide-calendar-days" /></span><p>Start with your real class schedule</p><h2>Build your weekly timetable</h2><span>Import your STARS timetable or add class sessions manually.</span><div class="header-actions"><UButton to="/app/timetable/import">Import timetable</UButton><UButton color="neutral" variant="outline" :disabled="!modules?.modules?.length" @click="add">Add class session</UButton></div></section>
    <template v-else>
      <p v-if="state.conflicts.length" class="module-alert"><UIcon name="i-lucide-triangle-alert" /> {{ state.conflicts.length }} timetable conflict{{ state.conflicts.length === 1 ? '' : 's' }} need attention.</p>
      <section class="timetable-grid" aria-label="Weekly timetable from 8 AM to 10 PM">
        <div class="timetable-grid__corner" />
        <div v-for="day in days" :key="day" class="timetable-grid__day" :class="{ 'is-today': today === day }">{{ dayLabels[day] }}<span v-if="today === day">Today</span></div>
        <div v-for="hour in 15" :key="hour" class="timetable-grid__time" :style="{ gridRow: `${(hour - 1) * 60 + 2} / span 60` }">{{ String(hour + 7).padStart(2, '0') }}:00</div>
        <div v-for="day in days" :key="`line-${day}`" class="timetable-grid__column" :style="{ gridColumn: days.indexOf(day) + 2 }" />
        <button v-for="session in state.sessions.filter(item => days.includes(item.dayOfWeek))" :key="session.id" class="timetable-event" :class="[`module-colour--${session.module.colour.toLowerCase()}`, { 'has-conflict': conflictIds.has(session.id) }]" :style="gridStyle(session)" @click="edit(session)"><strong>{{ session.module.code }}</strong><span>{{ session.classType }} · {{ session.groupLabel }}</span><small>{{ formatMinutes(session.startMinutes) }}–{{ formatMinutes(session.endMinutes) }}<template v-if="session.venue"> · {{ session.venue }}</template></small><em v-if="conflictIds.has(session.id)">Conflict</em></button>
      </section>
      <section class="timetable-agenda" aria-label="Weekly class agenda"><article v-for="day in days" :key="day" :class="{ 'is-today': today === day }"><h2>{{ dayLabels[day] }}<span v-if="today === day">Today</span></h2><p v-if="!state.days[day].length">No classes</p><button v-for="session in state.days[day]" :key="session.id" @click="edit(session)"><span :class="`module-colour--${session.module.colour.toLowerCase()}`" /><strong>{{ session.module.code }}</strong><span>{{ formatMinutes(session.startMinutes) }}–{{ formatMinutes(session.endMinutes) }}</span><small>{{ session.classType }} · {{ session.groupLabel }}<template v-if="session.venue"> · {{ session.venue }}</template></small><em v-if="conflictIds.has(session.id)">Conflict</em></button></article></section>
    </template>
    <TimetableSessionModal v-model:open="modalOpen" :session="selected" :enrolments="modules?.modules || []" @save="save" @delete="remove" />
    <p v-if="saving" class="sr-only" role="status">Saving class session…</p>
  </main>
</template>
