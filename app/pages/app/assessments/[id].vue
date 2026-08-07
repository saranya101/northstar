<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
const route = useRoute()
const { details, loading, saving, error, loadOne, update, remove, createDeliverable, updateDeliverable, deleteDeliverable, createMilestone, updateMilestone, deleteMilestone } = useAssessments()
const { tasks: linkedTasks, load: loadTasks } = useTasks()
const assessment = computed(() => details.value[route.params.id])
const form = reactive({})
const deliverableTitle = ref('')
const milestone = reactive({ title: '', dueDate: '', status: 'NOT_STARTED', estimatedEffortMinutes: null, notes: '' })
const deleteOpen = ref(false)
const statuses = ['NOT_STARTED','PLANNING','IN_PROGRESS','WAITING_ON_TEAMMATE','READY_FOR_REVIEW','SUBMITTED','GRADED','OVERDUE','CANCELLED']
useSeoMeta({ title: () => assessment.value ? `${assessment.value.name} · Northstar` : 'Assessment · Northstar' })
watch(assessment, value => { if (value) { Object.assign(form, value, { officialDeadline: inputDate(value.officialDeadline), internalDeadline: inputDate(value.internalDeadline), eventDate: inputDate(value.eventDate) }); void loadTasks({ assessmentId: value.id, view: 'ALL' }) } }, { immediate: true })
onMounted(() => void loadOne(route.params.id))
function inputDate(value) { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
function iso(value) { return value ? new Date(value).toISOString() : null }
const label = value => value?.replaceAll('_',' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const taskForMilestone = id => linkedTasks.value.find(task => task.assessmentMilestoneId === id)
const assessmentTaskRoute = extra => ({ path: '/app/tasks', query: { create: '1', title: extra?.title || '', moduleEnrolmentId: assessment.value.userModuleEnrolmentId, assessmentId: assessment.value.id, assessmentMilestoneId: extra?.id, dueAt: extra?.dueDate, estimatedMinutes: extra?.estimatedEffortMinutes } })
async function save() {
  await update(route.params.id, {
    name: form.name, type: form.type, weight: form.weight, officialDeadline: iso(form.officialDeadline), internalDeadline: iso(form.internalDeadline), eventDate: iso(form.eventDate),
    submissionPlatform: form.submissionPlatform, submissionUrl: form.submissionUrl, instructions: form.instructions, examFormat: form.examFormat,
    estimatedEffortMinutes: form.estimatedEffortMinutes, actualEffortMinutes: form.actualEffortMinutes, groupAssessment: form.groupAssessment,
    status: form.status, score: form.score, maximumScore: form.maximumScore, feedback: form.feedback, reflection: form.reflection,
    submittedAt: form.submittedAt, gradedAt: form.gradedAt
  })
}
async function refresh() { await loadOne(route.params.id, true) }
async function addDeliverable() { if (await createDeliverable(route.params.id, { title: deliverableTitle.value })) { deliverableTitle.value = ''; await refresh() } }
async function toggleDeliverable(item) { if (await updateDeliverable(route.params.id, item.id, { completed: !item.completed })) await refresh() }
async function removeDeliverable(id) { if (await deleteDeliverable(route.params.id, id)) await refresh() }
async function addMilestone() { if (await createMilestone(route.params.id, { ...milestone, dueDate: iso(milestone.dueDate) })) { Object.assign(milestone, { title: '', dueDate: '', status: 'NOT_STARTED', estimatedEffortMinutes: null, notes: '' }); await refresh() } }
async function setMilestone(item, status) { if (await updateMilestone(route.params.id, item.id, { status })) await refresh() }
async function removeMilestone(id) { if (await deleteMilestone(route.params.id, id)) await refresh() }
async function confirmDelete() { if (await remove(route.params.id)) await navigateTo(`/app/modules/${assessment.value.userModuleEnrolmentId}#assessments`) }
</script>

<template>
  <main class="app-page assessment-workspace">
    <p v-if="loading && !assessment" role="status">Loading assessment workspace…</p>
    <p v-else-if="!assessment" class="module-alert" role="alert">{{ error || 'Assessment unavailable.' }}</p>
    <template v-else>
      <NuxtLink :to="`/app/modules/${assessment.userModuleEnrolmentId}#assessments`" class="dossier-back"><UIcon name="i-lucide-arrow-left" /> Back to module</NuxtLink>
      <header class="review-header"><div><p>{{ label(assessment.type) }}</p><h1>{{ assessment.name }}</h1><span>{{ assessment.weight ?? 'Unknown' }}% · {{ label(assessment.status) }}</span></div><div class="academic-actions"><UButton :to="assessmentTaskRoute({ title: '' })" color="neutral" variant="outline">Create task</UButton><UBadge color="neutral" variant="outline">{{ assessment.percentageScore === null ? 'Not graded' : `${assessment.percentageScore}%` }}</UBadge></div></header>
      <section class="dossier-section"><div class="dossier-section__heading"><div><p>Confirmed record</p><h2>Assessment summary</h2></div></div>
        <form class="module-form" @submit.prevent="save">
          <div class="module-form__grid"><div class="module-field"><label for="workspace-name">Name</label><UInput id="workspace-name" v-model="form.name" required /></div><div class="module-field"><label for="workspace-status">Status</label><USelect id="workspace-status" v-model="form.status" :items="statuses" /></div></div>
          <div class="module-form__grid module-form__grid--three"><div class="module-field"><label for="workspace-weight">Weight %</label><UInput id="workspace-weight" v-model.number="form.weight" type="number" min="0" max="100" step=".1" /></div><div class="module-field"><label for="workspace-official">Official deadline</label><input id="workspace-official" v-model="form.officialDeadline" type="datetime-local"></div><div class="module-field"><label for="workspace-internal">Internal deadline</label><input id="workspace-internal" v-model="form.internalDeadline" type="datetime-local"></div></div>
          <div class="module-field"><label for="workspace-instructions">Instructions</label><UTextarea id="workspace-instructions" v-model="form.instructions" :rows="6" /></div>
          <div class="module-form__grid"><div class="module-field"><label for="workspace-platform">Submission platform</label><UInput id="workspace-platform" v-model="form.submissionPlatform" /></div><div class="module-field"><label for="workspace-url">Submission link</label><UInput id="workspace-url" v-model="form.submissionUrl" type="url" /></div></div>
          <div class="module-form__grid module-form__grid--three"><div class="module-field"><label for="workspace-score">Score</label><UInput id="workspace-score" v-model.number="form.score" type="number" min="0" step=".01" /></div><div class="module-field"><label for="workspace-max">Maximum score</label><UInput id="workspace-max" v-model.number="form.maximumScore" type="number" min=".01" step=".01" /></div><div class="module-field"><label for="workspace-effort">Estimated effort (minutes)</label><UInput id="workspace-effort" v-model.number="form.estimatedEffortMinutes" type="number" min="0" /></div></div>
          <div class="module-field"><label for="workspace-feedback">Feedback</label><UTextarea id="workspace-feedback" v-model="form.feedback" :rows="4" /></div><div class="module-field"><label for="workspace-reflection">Reflection</label><UTextarea id="workspace-reflection" v-model="form.reflection" :rows="4" /></div>
          <p v-if="error" class="module-alert" role="alert">{{ error }}</p><div class="module-form__actions"><UButton type="submit" :loading="saving">Save assessment</UButton></div>
        </form>
      </section>

      <div class="workspace-grid">
        <section class="dossier-section"><div class="dossier-section__heading"><div><p>Output checklist</p><h2>Deliverables</h2></div></div>
          <form class="inline-add" @submit.prevent="addDeliverable"><label class="sr-only" for="new-deliverable">Deliverable title</label><UInput id="new-deliverable" v-model="deliverableTitle" placeholder="Add a deliverable" required /><UButton type="submit" :loading="saving">Add</UButton></form>
          <ul class="workspace-list"><li v-for="item in assessment.deliverables" :key="item.id"><button :aria-label="`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`" @click="toggleDeliverable(item)"><UIcon :name="item.completed ? 'i-lucide-circle-check' : 'i-lucide-circle'" /></button><span :class="{ completed: item.completed }">{{ item.title }}</span><button aria-label="Delete deliverable" @click="removeDeliverable(item.id)"><UIcon name="i-lucide-trash-2" /></button></li></ul>
        </section>
        <section class="dossier-section"><div class="dossier-section__heading"><div><p>Assessment-specific plan</p><h2>Milestones</h2></div></div>
          <form class="milestone-form" @submit.prevent="addMilestone"><div class="module-field"><label for="new-milestone">Title</label><UInput id="new-milestone" v-model="milestone.title" required /></div><div class="module-field"><label for="milestone-date">Due date</label><input id="milestone-date" v-model="milestone.dueDate" type="datetime-local"></div><UButton type="submit" :loading="saving">Add milestone</UButton></form>
          <ul class="workspace-list"><li v-for="item in assessment.milestones" :key="item.id"><div><strong>{{ item.title }}</strong><small>{{ item.dueDate ? new Date(item.dueDate).toLocaleString('en-SG') : 'No date' }}</small></div><UButton :to="taskForMilestone(item.id) ? `/app/tasks?view=ALL` : assessmentTaskRoute(item)" size="xs" color="neutral" variant="ghost">{{ taskForMilestone(item.id) ? 'Open task' : 'Create task' }}</UButton><USelect :model-value="item.status" :items="['NOT_STARTED','IN_PROGRESS','COMPLETED','CANCELLED']" aria-label="Milestone status" @update:model-value="value => setMilestone(item, value)" /><button aria-label="Delete milestone" @click="removeMilestone(item.id)"><UIcon name="i-lucide-trash-2" /></button></li></ul>
        </section>
      </div>

      <section class="dossier-section"><div class="dossier-section__heading"><div><p>Source trail</p><h2>Provenance</h2></div></div><p v-if="!assessment.provenance.length" class="dossier-empty">This assessment was entered manually.</p><dl v-else class="provenance-list"><div v-for="item in assessment.provenance" :key="item.id"><dt>{{ label(item.fieldName) }}</dt><dd>{{ item.sourceLabel }}<small>{{ item.originalFileName || item.sourceType }}<template v-if="item.pageNumber"> · page {{ item.pageNumber }}</template> · {{ Math.round((item.confidence || 0) * 100) }}% confidence</small><blockquote v-if="item.sourceExcerpt">{{ item.sourceExcerpt }}</blockquote></dd></div></dl></section>
      <section class="dossier-danger"><div><h2>Delete assessment</h2><p>This removes its deliverables and milestones. Referenced course-outline provenance remains protected on other assessments.</p></div><UButton color="error" variant="soft" @click="deleteOpen = true">Delete assessment</UButton></section>
      <UModal v-model:open="deleteOpen" title="Delete assessment?" description="This cannot be undone."><template #footer><UButton color="neutral" variant="outline" @click="deleteOpen = false">Cancel</UButton><UButton color="error" :loading="saving" @click="confirmDelete">Delete</UButton></template></UModal>
    </template>
  </main>
</template>
