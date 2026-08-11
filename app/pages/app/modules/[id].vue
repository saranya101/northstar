<script setup>
import { deliveryModeIcon, deliveryModeLabel } from '~/utils/timetable-import/timetable-delivery'
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })

const route = useRoute()
const nuxtApp = useNuxtApp()
const { user } = useCurrentSession()
const { dossiers, loading, saving, error, fieldErrors, loadDossier, update, close, clearErrors } = useModules()
const instructorOpen = ref(false)
const sessionOpen = ref(false)
const selectedSession = ref(null)
const confirmMode = ref(null)
const savedMessage = ref('')
const dossier = computed(() => dossiers.value[route.params.id])
const settings = reactive({ targetGrade: '', colour: 'MINERAL', personalNotes: '', status: 'ACTIVE' })
const { saving: sessionSaving, addSession, updateSession, deleteSession } = useTimetable()

useSeoMeta({ title: () => dossier.value ? `${dossier.value.module.code} · Northstar` : 'Module · Northstar' })
watch(dossier, (value) => {
  if (!value) return
  Object.assign(settings, {
    targetGrade: value.enrolment.targetGrade || '',
    colour: value.enrolment.colour,
    personalNotes: value.enrolment.personalNotes || '',
    status: value.enrolment.status
  })
}, { immediate: true })

watch([user, () => route.params.id], ([currentUser, id]) => {
  if (currentUser && id) void loadDossier(id).catch(() => {})
}, { immediate: true })

function humanize(value) {
  return value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
}
function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(new Date(value)) : null
}
async function saveSettings() {
  savedMessage.value = ''
  const result = await update(route.params.id, settings)
  if (result) savedMessage.value = 'Personal module settings saved.'
}
async function confirmClose() {
  const mode = confirmMode.value
  const result = await close(route.params.id, mode)
  if (result) await nuxtApp.runWithContext(() => navigateTo('/app/modules'))
}
function editSession(session) { selectedSession.value = session; sessionOpen.value = true }
function newSession() { selectedSession.value = null; sessionOpen.value = true }
async function saveSession(payload) {
  const { enrolmentId, ...body } = payload
  const result = selectedSession.value ? await updateSession(selectedSession.value.id, body) : await addSession(enrolmentId, body)
  if (result) { sessionOpen.value = false; await loadDossier(route.params.id, true) }
}
async function removeSession(id) { if (await deleteSession(id)) { sessionOpen.value = false; await loadDossier(route.params.id, true) } }
function sessionTime(session) { const render = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; return `${render(session.startMinutes)}–${render(session.endMinutes)}` }
</script>

<template>
  <main class="app-page v2-page dossier-page">
    <div v-if="!dossier && (loading || !error)" class="dossier-skeleton" aria-label="Loading module dossier">
      <div class="app-skeleton app-skeleton--dossier"><span /><span /><span /><span /></div>
      <div class="app-skeleton app-skeleton--panel"><span /><span /><span /></div>
    </div>
    <p v-else-if="!dossier" class="module-alert" role="alert">{{ error || 'Module dossier unavailable.' }}</p>
    <template v-else>
      <NuxtLink to="/app/modules" class="dossier-back"><UIcon name="i-lucide-arrow-left" /> Back to modules</NuxtLink>
      <header class="dossier-header">
        <span class="dossier-header__colour" :class="`module-colour--${dossier.enrolment.colour.toLowerCase()}`" aria-hidden="true" />
        <div class="dossier-header__main"><p>{{ dossier.module.code }}</p><h1>{{ dossier.module.title }}</h1><div class="dossier-badges"><UBadge color="neutral" variant="outline">{{ humanize(dossier.enrolment.status) }}</UBadge><UBadge color="primary" variant="soft">{{ humanize(dossier.module.sourceStatus) }}</UBadge></div></div>
        <dl>
          <div><dt>Academic units</dt><dd>{{ dossier.module.academicUnits ?? 'Not provided' }}</dd></div>
          <div><dt>Active term</dt><dd>{{ dossier.offering.academicTerm.academicYear }} · {{ dossier.offering.academicTerm.name }}</dd></div>
          <div v-if="dossier.offering.sectionLabel !== 'DEFAULT'"><dt>Section</dt><dd>{{ dossier.offering.sectionLabel }}</dd></div>
          <div v-if="dossier.module.lastVerifiedAt"><dt>Last verified</dt><dd>{{ formatDate(dossier.module.lastVerifiedAt) }}</dd></div>
        </dl>
      </header>

      <nav class="module-subnav" aria-label="Module sections"><a href="#overview">Overview</a><a href="#preparation">Preparation</a><a href="#assessments">Assessments</a><a href="#coursework">Coursework</a><NuxtLink :to="`/app/tasks?moduleEnrolmentId=${route.params.id}`">Tasks</NuxtLink><a href="#sessions">Schedule</a><a href="#assessments">Grades</a><NuxtLink :to="{ path: '/app/inbox', query: { moduleEnrolmentId: route.params.id } }">Paste update</NuxtLink></nav>

      <section id="overview" class="dossier-section">
        <div class="dossier-section__heading"><div><p>Shared record</p><h2>Academic details</h2></div></div>
        <p class="dossier-description">{{ dossier.module.description || 'No module description has been added yet.' }}</p>
        <dl class="dossier-details">
          <div><dt>Grading basis</dt><dd>{{ dossier.module.gradingBasis || dossier.offering.gradingType || 'Not provided' }}</dd></div>
          <div><dt>Current section</dt><dd>{{ dossier.offering.sectionLabel === 'DEFAULT' ? 'No specific section' : dossier.offering.sectionLabel }}</dd></div>
          <div><dt>Provenance</dt><dd>{{ humanize(dossier.module.sourceStatus) }}<small v-if="dossier.module.verificationStatus === 'PUBLIC_SOURCE_MATCH'">Matched against NTU public course information.</small><small v-else-if="dossier.module.verificationStatus === 'PUBLIC_SOURCE_CONFLICT'">NTU public information differed; the reviewed student selection was retained.</small><small v-else-if="dossier.module.sourceStatus === 'USER_ENTERED'">Supplied by a Northstar user and not officially verified.</small></dd></div>
        </dl>
        <div class="dossier-links"><UButton v-if="dossier.module.officialUrl" :to="dossier.module.officialUrl" target="_blank" color="neutral" variant="outline">Official module page</UButton><UButton v-if="dossier.offering.syllabusUrl" :to="dossier.offering.syllabusUrl" target="_blank" color="neutral" variant="outline">Syllabus</UButton><span v-if="!dossier.module.officialUrl && !dossier.offering.syllabusUrl">No official links have been connected.</span></div>
      </section>

      <AcademicPreparationPanel :enrolment-id="route.params.id" :module-code="dossier.module.code" :class-sessions="dossier.classSessions" :academic-term="dossier.offering.academicTerm" />
      <AcademicAssessmentsPanel :enrolment-id="route.params.id" />
      <AcademicRecurringCourseworkPanel :enrolment-id="route.params.id" />

      <section id="sessions" class="dossier-section">
        <div class="dossier-section__heading"><div><p>Recurring schedule</p><h2>Class sessions</h2></div><UButton icon="i-lucide-plus" color="neutral" variant="outline" @click="newSession">Add session</UButton></div>
        <dl class="dossier-details"><div><dt>Index number</dt><dd>{{ dossier.enrolment.indexNumber || 'Not provided' }}</dd></div><div><dt>Registration status</dt><dd>{{ humanize(dossier.enrolment.registrationStatus) }}</dd></div><div><dt>Course type</dt><dd>{{ dossier.enrolment.courseType || 'Not provided' }}</dd></div></dl>
        <div v-if="dossier.classSessions.length" class="session-list"><button v-for="session in dossier.classSessions" :key="session.id" @click="editSession(session)"><strong>{{ humanize(session.classType) }}</strong><span>{{ humanize(session.dayOfWeek) }} · {{ sessionTime(session) }}</span><small>{{ session.groupLabel }}<template v-if="session.venue"> · {{ session.venue }}</template> · {{ humanize(session.recurrence) }}</small><span class="delivery-label"><UIcon :name="deliveryModeIcon(session.deliveryMode)" /> {{ deliveryModeLabel(session.deliveryMode) }}</span><UIcon name="i-lucide-pencil" /></button></div>
        <p v-else class="dossier-empty">No class sessions have been added for this module.</p>
      </section>

      <section id="instructors" class="dossier-section">
        <div class="dossier-section__heading"><div><p>Current offering</p><h2>Teaching team</h2></div><UButton icon="i-lucide-user-plus" color="neutral" variant="outline" @click="instructorOpen = true">Add instructor</UButton></div>
        <div v-if="dossier.instructors.length" class="instructor-list">
          <article v-for="instructor in dossier.instructors" :key="`${instructor.id}-${instructor.role}`">
            <div><h3>{{ instructor.fullName }}</h3><p>{{ [instructor.title, humanize(instructor.role)].filter(Boolean).join(' · ') }}</p></div>
            <UBadge color="neutral" variant="outline">{{ humanize(instructor.sourceStatus) }}</UBadge>
            <div class="instructor-list__links"><a v-if="instructor.officialEmail" :href="`mailto:${instructor.officialEmail}`">{{ instructor.officialEmail }}</a><a v-if="instructor.officialProfileUrl" :href="instructor.officialProfileUrl" target="_blank" rel="noopener">Official profile</a><small v-if="instructor.lastVerifiedAt">Verified {{ formatDate(instructor.lastVerifiedAt) }}</small></div>
          </article>
        </div>
        <p v-else class="dossier-empty">No teaching staff have been added for this offering.</p>
      </section>

      <section class="dossier-section">
        <div class="dossier-section__heading"><div><p>Private to you</p><h2>Personal settings</h2></div></div>
        <form class="module-form" @submit.prevent="saveSettings">
          <p v-if="savedMessage" class="module-success" role="status" aria-live="polite">{{ savedMessage }}</p>
          <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
          <div class="module-form__grid">
            <div class="module-field"><label for="dossier-grade">Target grade <em>optional</em></label><UInput id="dossier-grade" v-model="settings.targetGrade" maxlength="10" /></div>
            <div class="module-field"><label for="dossier-status">Enrolment status</label><USelect id="dossier-status" v-model="settings.status" :items="['ACTIVE', 'COMPLETED']" /></div>
          </div>
          <ModulesModuleColourPicker v-model="settings.colour" />
          <div class="module-field"><label for="personal-notes">Personal notes <em>private</em></label><UTextarea id="personal-notes" v-model="settings.personalNotes" :rows="6" maxlength="5000" /><small>{{ fieldErrors.personalNotes }}</small></div>
          <div class="module-form__actions"><UButton type="submit" :loading="saving">Save personal settings</UButton></div>
        </form>
      </section>

      <section class="dossier-danger">
        <div><h2>Change enrolment</h2><p>Your private history is preserved, and the shared module and offering remain available.</p></div>
        <div><UButton color="neutral" variant="outline" @click="clearErrors(); confirmMode = 'archive'">Archive module</UButton><UButton color="error" variant="soft" @click="clearErrors(); confirmMode = 'drop'">Drop module</UButton></div>
      </section>

      <ModulesAddInstructorModal v-model:open="instructorOpen" :enrolment-id="route.params.id" />
      <TimetableSessionModal v-model:open="sessionOpen" :session="selectedSession" :fixed-enrolment-id="route.params.id" :enrolments="[]" @save="saveSession" @delete="removeSession" />
      <p v-if="sessionSaving" class="sr-only" role="status">Saving class session…</p>
      <UModal :open="Boolean(confirmMode)" :title="confirmMode === 'archive' ? 'Archive module?' : 'Drop module?'" description="The shared catalogue record will remain available and your personal historical enrolment data will be preserved." @update:open="value => { if (!value) confirmMode = null }">
        <template #footer>
          <UButton color="neutral" variant="outline" @click="confirmMode = null">Cancel</UButton>
          <UButton :color="confirmMode === 'drop' ? 'error' : 'primary'" :loading="saving" @click="confirmClose">{{ confirmMode === 'archive' ? 'Archive module' : 'Drop module' }}</UButton>
        </template>
      </UModal>
    </template>
  </main>
</template>
