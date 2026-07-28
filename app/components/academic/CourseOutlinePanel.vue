<script setup>
import { extractCourseOutlineFile, sanitiseCourseOutlineText } from '~/utils/course-outline-import/extract-file.client'
const props = defineProps({ enrolmentId: { type: String, required: true } })
const { imports, loading, saving, error, load, create, cancel, remove } = useCourseOutlineImports()
const mode = ref('file')
const file = ref(null)
const pastedText = ref('')
const progress = ref(null)
const extracting = ref(false)
const list = computed(() => imports.value[props.enrolmentId] || [])
onMounted(() => void load(props.enrolmentId))

function selectFile(event) { file.value = event.target.files?.[0] || null }
function formatDate(value) { return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(new Date(value)) }
async function begin() {
  extracting.value = true
  try {
    const extracted = mode.value === 'file'
      ? await extractCourseOutlineFile(file.value, { onProgress: value => { progress.value = value } })
      : { text: sanitiseCourseOutlineText(pastedText.value), confidence: 1, sourceType: 'TEXT', mimeType: 'text/plain' }
    const result = await create(props.enrolmentId, {
      originalFileName: file.value?.name,
      mimeType: extracted.mimeType,
      sourceType: extracted.sourceType,
      sourceLabel: file.value?.name || 'Pasted course outline',
      extractedText: extracted.text,
      extractionConfidence: extracted.confidence
    })
    if (result) await navigateTo(`/app/course-outline-imports/${result.id}`)
  } finally { extracting.value = false; progress.value = null }
}
async function cancelImport(item) { if (await cancel(item.id)) await load(props.enrolmentId, true) }
async function deleteImport(item) { if (await remove(item.id)) await load(props.enrolmentId, true) }
</script>

<template>
  <section id="course-outline" class="dossier-section academic-panel" aria-labelledby="outline-title">
    <div class="dossier-section__heading"><div><p>Review before save</p><h2 id="outline-title">Course outline</h2></div></div>
    <p class="academic-help">Import a PDF, image, plain-text file, or paste text. Northstar retains private extracted text and provenance, but not the original file. Nothing becomes a confirmed assessment until you approve it.</p>
    <div class="academic-import">
      <div class="academic-tabs" role="tablist" aria-label="Course outline source">
        <button :aria-selected="mode === 'file'" role="tab" @click="mode = 'file'">Upload file</button>
        <button :aria-selected="mode === 'text'" role="tab" @click="mode = 'text'">Paste text</button>
      </div>
      <div v-if="mode === 'file'" class="module-field"><label for="outline-file">Course outline file</label><input id="outline-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain" @change="selectFile"><small>PDF, image, or text · maximum 10 MB</small></div>
      <div v-else class="module-field"><label for="outline-text">Course outline text</label><UTextarea id="outline-text" v-model="pastedText" :rows="9" placeholder="Paste the course outline here…" /></div>
      <p v-if="progress" role="status">{{ progress.label }} · {{ Math.round(progress.progress * 100) }}%</p>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <UButton :loading="extracting || saving" :disabled="mode === 'file' ? !file : pastedText.trim().length < 20" @click="begin">Extract and review</UButton>
    </div>
    <div class="import-history">
      <h3>Import history</h3>
      <p v-if="loading" role="status">Loading import history…</p>
      <p v-else-if="!list.length" class="dossier-empty">No course outlines imported yet.</p>
      <article v-for="item in list" v-else :key="item.id">
        <div><strong>{{ item.originalFileName || item.sourceLabel }}</strong><span>{{ formatDate(item.createdAt) }} · {{ item.extractedAssessmentCount }} extracted · {{ item.confirmedAssessmentCount }} confirmed</span><small>{{ [item.academicYear, item.semesterLabel].filter(Boolean).join(' · ') || 'Term not detected' }}</small></div>
        <UBadge :color="item.historical ? 'warning' : item.status === 'CONFIRMED' ? 'success' : 'neutral'">{{ item.historical ? 'Historical' : item.status.replaceAll('_', ' ') }}</UBadge>
        <div class="academic-actions">
          <UButton v-if="item.status === 'REVIEW_REQUIRED'" :to="`/app/course-outline-imports/${item.id}`" color="neutral" variant="outline">Resume review</UButton>
          <UButton v-if="item.status === 'REVIEW_REQUIRED'" color="neutral" variant="ghost" @click="cancelImport(item)">Cancel</UButton>
          <UButton v-if="['FAILED','CANCELLED'].includes(item.status)" color="error" variant="ghost" @click="deleteImport(item)">Delete</UButton>
        </div>
      </article>
    </div>
  </section>
</template>
