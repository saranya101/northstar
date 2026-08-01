<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
const route = useRoute()
const { reviews, loading, saving, error, fieldErrors, loadOne, update, confirm, cancel } = useCourseOutlineImports()
const review = computed(() => reviews.value[route.params.id])
const candidates = ref([])
const facts = ref([])
const weeks = ref([])
const confirmedCurrent = ref(false)
const newCandidate = reactive({ name: '', type: 'OTHER', weight: null, officialDeadline: '', eventDate: '', groupAssessment: null, instructions: '', submissionUrl: '', examFormat: '', deliverables: '', status: 'SELECTED' })
const adding = ref(false)
const types = ['QUIZ','MIDTERM','FINAL_EXAMINATION','INDIVIDUAL_ASSIGNMENT','GROUP_ASSIGNMENT','PRESENTATION','CLASS_PARTICIPATION','ATTENDANCE','REFLECTION','CASE_ANALYSIS','REPORT','PROJECT','PRACTICAL','LABORATORY','ORAL_EXAMINATION','PEER_ASSESSMENT','OTHER']
useSeoMeta({ title: 'Review course outline · Northstar' })
watch(review, value => {
  if (!value) return
  candidates.value = value.candidates.map(item => ({ ...item, provenance: item.provenance.map(source => ({ ...source })), officialDeadline: inputDate(item.officialDeadline), eventDate: inputDate(item.eventDate), deliverablesText: item.deliverables.join('\n') }))
  facts.value = value.facts.map(item => ({ ...item }))
  weeks.value = value.weeks.map(item => ({ ...item }))
  confirmedCurrent.value = value.userConfirmedCurrent
}, { immediate: true })
onMounted(() => void loadOne(route.params.id))

function inputDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function iso(value) { return value ? new Date(value).toISOString() : null }
function confidence(value) { return value === null || value === undefined ? 'Not detected' : `${Math.round(Number(value) * 100)}% confidence` }
function candidateBody(item) {
  return {
    id: item.id, status: item.status, name: item.name || null, type: item.type || null, weight: item.weight,
    officialDeadline: iso(item.officialDeadline), eventDate: iso(item.eventDate), submissionPlatform: item.submissionPlatform,
    submissionUrl: item.submissionUrl, instructions: item.instructions, groupAssessment: item.groupAssessment,
    examFormat: item.examFormat, durationMinutes: item.durationMinutes,
    deliverables: item.deliverablesText.split('\n').map(value => value.trim()).filter(Boolean)
  }
}
function newBody() {
  return {
    ...newCandidate, officialDeadline: iso(newCandidate.officialDeadline), eventDate: iso(newCandidate.eventDate),
    weight: newCandidate.weight, deliverables: newCandidate.deliverables.split('\n').map(value => value.trim()).filter(Boolean)
  }
}
async function save(includeNew = false) {
  const result = await update(route.params.id, {
    expectedUpdatedAt: review.value.updatedAt,
    userConfirmedCurrent: confirmedCurrent.value,
    candidates: candidates.value.map(candidateBody),
    newCandidates: includeNew ? [newBody()] : [],
    facts: facts.value.map(item => ({ id: item.id, value: item.value, selected: item.selected })),
    weeks: weeks.value.map(item => ({ id: item.id, weekNumber: item.weekNumber, topic: item.topic, reading: item.reading, activity: item.activity, importantDate: item.importantDate, selected: item.selected }))
  })
  if (result && includeNew) { adding.value = false; Object.assign(newCandidate, { name: '', type: 'OTHER', weight: null, officialDeadline: '', eventDate: '', groupAssessment: null, instructions: '', submissionUrl: '', examFormat: '', deliverables: '', status: 'SELECTED' }) }
  return result
}
async function finish() {
  const saved = await save()
  if (!saved) return
  const result = await confirm(route.params.id, saved.updatedAt)
  if (result) await navigateTo(`/app/modules/${review.value.userModuleEnrolmentId}#assessments`)
}
async function abandon() { if (await cancel(route.params.id)) await navigateTo(`/app/modules/${review.value.userModuleEnrolmentId}#course-outline`) }
</script>

<template>
  <main class="app-page review-page">
    <p v-if="loading && !review" role="status">Loading course outline review…</p>
    <p v-else-if="!review" class="module-alert" role="alert">{{ error || 'Review unavailable.' }}</p>
    <template v-else>
      <NuxtLink :to="`/app/modules/${review.userModuleEnrolmentId}#course-outline`" class="dossier-back"><UIcon name="i-lucide-arrow-left" /> Back to module</NuxtLink>
      <header class="review-header"><div><p>Course outline review</p><h1>{{ review.module.code }} · {{ review.module.title }}</h1><span>{{ review.originalFileName || review.sourceLabel }} · {{ review.sourceType }}</span></div><UBadge :color="review.historical ? 'warning' : 'neutral'">{{ review.historical ? 'Historical source' : 'Review required' }}</UBadge></header>
      <div class="module-alert review-privacy"><UIcon name="i-lucide-shield-check" /><span>The original file is not retained. Extracted private text and small provenance excerpts are stored only for this review.</span></div>
      <section v-if="review.warnings.length" class="review-warnings" aria-labelledby="warning-title"><h2 id="warning-title"><UIcon name="i-lucide-triangle-alert" /> Parser warnings</h2><ul><li v-for="warning in review.warnings" :key="warning">{{ warning }}</li></ul></section>
      <label class="review-current"><input v-model="confirmedCurrent" type="checkbox"> I confirm this outline applies to {{ review.module.academicYear }} · {{ review.module.semester }}.</label>

      <section class="dossier-section">
        <div class="dossier-section__heading"><div><p>Extracted facts</p><h2>Module information</h2></div></div>
        <p v-if="!facts.length" class="dossier-empty">No module information was confidently detected.</p>
        <div v-else class="review-facts">
          <label v-for="item in facts" :key="item.id"><input v-model="item.selected" type="checkbox"><span>{{ item.fieldName.replaceAll(/([A-Z])/g, ' $1') }}</span><UTextarea v-model="item.value" :rows="2" /><small>{{ confidence(item.confidence) }}<template v-if="item.pageNumber"> · Page {{ item.pageNumber }}</template><template v-if="item.sourceExcerpt"> · “{{ item.sourceExcerpt }}”</template></small></label>
        </div>
      </section>

      <section class="dossier-section">
        <div class="dossier-section__heading"><div><p>Choose what to confirm</p><h2>Assessments</h2></div><UButton color="neutral" variant="outline" @click="adding = !adding">Add missing assessment</UButton></div>
        <form v-if="adding" class="candidate-card candidate-card--new" @submit.prevent="save(true)">
          <h3>Manual assessment candidate</h3>
          <div class="module-form__grid"><div class="module-field"><label for="new-name">Name</label><UInput id="new-name" v-model="newCandidate.name" required /></div><div class="module-field"><label for="new-type">Type</label><USelect id="new-type" v-model="newCandidate.type" :items="types" /></div></div>
          <div class="module-form__grid"><div class="module-field"><label for="new-weight">Weight %</label><UInput id="new-weight" v-model.number="newCandidate.weight" type="number" min="0" max="100" step=".1" /></div><div class="module-field"><label for="new-deadline">Official deadline</label><input id="new-deadline" v-model="newCandidate.officialDeadline" type="datetime-local"></div></div>
          <UButton type="submit" :loading="saving">Add to review</UButton>
        </form>
        <p v-if="!candidates.length" class="dossier-empty">No assessments were detected. Add missing assessments manually.</p>
        <article v-for="(item, index) in candidates" :key="item.id" class="candidate-card" :class="{ 'candidate-card--rejected': item.status === 'REJECTED' }">
          <div class="candidate-card__heading"><h3>Assessment {{ index + 1 }}</h3><div><UButton color="neutral" variant="ghost" size="sm" @click="item.status = item.status === 'SELECTED' ? 'REJECTED' : 'SELECTED'">{{ item.status === 'SELECTED' ? 'Reject' : 'Restore' }}</UButton><UBadge :color="item.status === 'SELECTED' ? 'success' : 'neutral'">{{ item.status }}</UBadge></div></div>
          <div class="module-form__grid"><div class="module-field"><label :for="`name-${item.id}`">Name</label><UInput :id="`name-${item.id}`" v-model="item.name" /></div><div class="module-field"><label :for="`type-${item.id}`">Type</label><USelect :id="`type-${item.id}`" v-model="item.type" :items="types" /></div></div>
          <div class="module-form__grid module-form__grid--three"><div class="module-field"><label :for="`weight-${item.id}`">Weight %</label><UInput :id="`weight-${item.id}`" v-model.number="item.weight" type="number" min="0" max="100" step=".1" /></div><div class="module-field"><label :for="`deadline-${item.id}`">Official deadline</label><input :id="`deadline-${item.id}`" v-model="item.officialDeadline" type="datetime-local"></div><div class="module-field"><label :for="`event-${item.id}`">Exam/event date</label><input :id="`event-${item.id}`" v-model="item.eventDate" type="datetime-local"></div></div>
          <div class="module-field"><label :for="`instructions-${item.id}`">Instructions</label><UTextarea :id="`instructions-${item.id}`" v-model="item.instructions" :rows="3" /></div>
          <div class="module-form__grid"><div class="module-field"><label :for="`url-${item.id}`">Submission link</label><UInput :id="`url-${item.id}`" v-model="item.submissionUrl" type="url" /></div><div class="module-field"><label :for="`exam-${item.id}`">Exam format</label><UInput :id="`exam-${item.id}`" v-model="item.examFormat" /></div></div>
          <div class="module-field"><label :for="`deliverables-${item.id}`">Deliverables <small>one per line</small></label><UTextarea :id="`deliverables-${item.id}`" v-model="item.deliverablesText" :rows="3" /></div>
          <dl class="candidate-provenance"><div v-for="source in item.provenance" :key="source.id"><dt>{{ source.fieldName }}</dt><dd>{{ confidence(source.confidence) }}<template v-if="source.pageNumber"> · page {{ source.pageNumber }}</template><small v-if="source.sourceExcerpt">“{{ source.sourceExcerpt }}”</small></dd></div></dl>
        </article>
      </section>

      <section class="dossier-section"><div class="dossier-section__heading"><div><p>Optional structure</p><h2>Weekly topics</h2></div></div><p v-if="!weeks.length" class="dossier-empty">No weekly structure was detected.</p><div v-else class="week-review"><label v-for="item in weeks" :key="item.id"><input v-model="item.selected" type="checkbox"><strong>Week <UInput v-model.number="item.weekNumber" type="number" min="1" max="60" /></strong><UInput v-model="item.topic" placeholder="Topic" /><UInput v-model="item.reading" placeholder="Reading" /><UInput v-model="item.activity" placeholder="Tutorial or activity" /><UInput v-model="item.importantDate" placeholder="Week-based date or time" /></label></div></section>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <p v-if="Object.keys(fieldErrors).length" class="module-alert" role="alert">{{ Object.values(fieldErrors).join(' ') }}</p>
      <footer class="review-actions"><UButton color="neutral" variant="ghost" @click="abandon">Cancel import</UButton><UButton color="neutral" variant="outline" :loading="saving" @click="save()">Save and return later</UButton><UButton :loading="saving" @click="finish">Confirm selected assessments</UButton></footer>
    </template>
  </main>
</template>
