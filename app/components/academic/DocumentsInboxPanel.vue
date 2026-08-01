<script setup>
import { COURSE_DOCUMENT_TYPES } from '#shared/schemas/academic'
import { prepareCourseDocumentFile, preparePastedCourseDocument } from '~/utils/course-document-inbox/prepare-document.client'

const props = defineProps({ enrolmentId: { type: String, required: true } })
const { documents, loading, saving, error, load, create, archive } = useCourseDocuments()
const mode = ref('file')
const file = ref(null)
const pastedText = ref('')
const documentType = ref('ASSESSMENT_BRIEF')
const displayTitle = ref('')
const sourceDate = ref('')
const progress = ref(null)
const message = ref('')
const extracting = ref(false)
const list = computed(() => documents.value[props.enrolmentId] || [])

onMounted(() => void load(props.enrolmentId))
function selectFile(event) { file.value = event.target.files?.[0] || null; if (!displayTitle.value) displayTitle.value = file.value?.name?.replace(/\.[^.]+$/, '') || '' }
function label(value) { return value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) }
function formatDate(value) { return value ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided' }
function reviewUrl(item) { return item.sha256Hash ? `/app/course-documents/${item.id}` : `/app/course-outline-imports/${item.id}` }

async function begin() {
  extracting.value = true; message.value = ''
  try {
    const extracted = mode.value === 'file'
      ? await prepareCourseDocumentFile(file.value, { onProgress: value => { progress.value = value } })
      : await preparePastedCourseDocument(pastedText.value)
    const result = await create(props.enrolmentId, {
      documentType: documentType.value,
      displayTitle: displayTitle.value || extracted.originalFileName || label(documentType.value),
      originalFileName: extracted.originalFileName,
      mimeType: extracted.mimeType,
      fileSize: extracted.fileSize,
      sha256Hash: extracted.sha256Hash,
      sourceType: extracted.sourceType,
      sourceDate: sourceDate.value ? new Date(`${sourceDate.value}T00:00:00`).toISOString() : null,
      extractedText: extracted.text,
      extractionConfidence: extracted.confidence
    })
    if (!result) return
    if (result.duplicate) message.value = 'This exact file was already imported. The existing document was kept without creating duplicates.'
    else await navigateTo(`/app/course-documents/${result.id}`)
  } finally { extracting.value = false; progress.value = null }
}
</script>

<template>
  <section id="documents" class="dossier-section academic-panel" aria-labelledby="documents-title">
    <div class="dossier-section__heading"><div><p>Private source inbox</p><h2 id="documents-title">Course Document Inbox</h2></div></div>
    <p class="academic-help">Add briefs, schedules, rubrics and announcements. Northstar extracts private text and proposes changes for review; it never silently changes confirmed module data.</p>
    <div class="module-alert review-privacy"><UIcon name="i-lucide-shield-check" /><span>Original files are processed locally and are not retained. The title, file metadata, SHA-256 hash, extracted text and source evidence are stored privately.</span></div>
    <div class="academic-import document-upload">
      <div class="module-form__grid">
        <div class="module-field"><label for="document-type">Document type</label><USelect id="document-type" v-model="documentType" :items="COURSE_DOCUMENT_TYPES" /></div>
        <div class="module-field"><label for="document-title">Title <em>optional</em></label><UInput id="document-title" v-model="displayTitle" maxlength="255" placeholder="Defaults to filename or document type" /></div>
        <div class="module-field"><label for="document-source-date">Source date <em>optional</em></label><input id="document-source-date" v-model="sourceDate" type="date"></div>
      </div>
      <div class="academic-tabs" role="tablist" aria-label="Course document source"><button :aria-selected="mode === 'file'" role="tab" @click="mode = 'file'">Upload file</button><button :aria-selected="mode === 'text'" role="tab" @click="mode = 'text'">Paste text</button></div>
      <div v-if="mode === 'file'" class="module-field"><label for="document-file">Academic document</label><input id="document-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain" @change="selectFile"><small>PDF, image, or text · maximum 10 MB</small></div>
      <div v-else class="module-field"><label for="document-text">Document text</label><UTextarea id="document-text" v-model="pastedText" :rows="8" placeholder="Paste the academic document text here…" /></div>
      <p v-if="progress" role="status">{{ progress.label }} · {{ Math.round(progress.progress * 100) }}%</p>
      <p v-if="message" class="module-success" role="status">{{ message }}</p>
      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <UButton :loading="extracting || saving" :disabled="mode === 'file' ? !file : pastedText.trim().length < 20" @click="begin">Extract and compare</UButton>
    </div>
    <div class="import-history document-list">
      <h3>Document inbox</h3>
      <p v-if="loading" role="status">Loading documents…</p>
      <p v-else-if="!list.length" class="dossier-empty">No documents have been added to this module.</p>
      <article v-for="item in list" v-else :key="item.id">
        <div><strong>{{ item.displayTitle }}</strong><span>{{ label(item.documentType) }} · imported {{ formatDate(item.createdAt) }}</span><small>Source date: {{ formatDate(item.sourceDate) }} · {{ item.proposalCount }} proposed changes</small><small v-if="item.duplicateCount">Duplicate upload detected {{ item.duplicateCount }} time(s)</small></div>
        <UBadge :color="item.status === 'CONFIRMED' ? 'success' : item.status === 'FAILED' ? 'error' : 'neutral'">{{ label(item.status) }}</UBadge>
        <div class="academic-actions">
          <UButton :to="reviewUrl(item)" color="neutral" variant="outline">{{ item.status === 'REVIEW_REQUIRED' ? 'Open review' : 'View evidence' }}</UButton>
          <UButton v-if="item.originalRetained" color="neutral" variant="ghost">Open original</UButton>
          <span v-else class="document-retention">Original file not retained</span>
          <UButton v-if="item.status !== 'ARCHIVED'" color="neutral" variant="ghost" @click="archive(props.enrolmentId, item.id)">Archive</UButton>
        </div>
      </article>
    </div>
  </section>
</template>
