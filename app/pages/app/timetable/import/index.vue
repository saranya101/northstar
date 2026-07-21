<script setup>
import { detectTimetableFormat } from '~/utils/timetable-import/format-detector'
import { validateTimetableFile } from '~/utils/timetable-import/file-validation'
import { parseNtuGrid } from '~/utils/timetable-import/ntu-grid-parser'
import { parseNtuRegisteredCourses } from '~/utils/timetable-import/ntu-registered-courses-parser'
import { parseNtuTimetableImage } from '~/utils/timetable-import/ntu-timetable-image-parser'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Import timetable · Northstar' })
const router = useRouter()
const { createImport, draftCandidate, saving, error } = useTimetable()
const pastedText = ref('')
const processing = ref(false)
const progress = ref({ label: '', progress: 0 })
const localError = ref('')
const controller = shallowRef(null)

async function createReview(candidate) {
  if (!candidate.modules.length) { localError.value = candidate.warnings[0] || 'No modules were detected. Paste clearer text or add sessions manually.'; return }
  const result = await createImport(candidate)
  if (result) await router.push(`/app/timetable/import/${result.id}`)
}
async function retryDraft() { if (draftCandidate.value) await createReview(draftCandidate.value) }
async function parsePasted() {
  localError.value = ''
  await createReview(parseNtuRegisteredCourses(pastedText.value, 'PASTED_TEXT'))
}
async function processFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  localError.value = ''; processing.value = true; controller.value = new AbortController()
  try {
    validateTimetableFile(file)
    progress.value = { label: 'File validated', progress: 0.05 }
    let extraction
    if (file.type === 'application/pdf') {
      const { extractPdf } = await import('~/utils/timetable-import/pdf-extractor.client')
      extraction = await extractPdf(file, { signal: controller.value.signal, onProgress: value => { progress.value = value } })
    } else {
      const { extractImage } = await import('~/utils/timetable-import/image-extractor.client')
      extraction = await extractImage(file, { signal: controller.value.signal, onProgress: value => { progress.value = value } })
    }
    const words = extraction.words || extraction.pages?.flatMap(page => page.words) || []
    const blocks = extraction.blocks || extraction.pages?.flatMap(page => page.blocks) || []
    if (file.type !== 'application/pdf') {
      progress.value = { label: 'Combining registered courses and timetable sessions', progress: 0.92 }
      await createReview(parseNtuTimetableImage(extraction, 'NTU_TIMETABLE_IMAGE'))
      return
    }
    const detected = detectTimetableFormat(extraction.text, words)
    progress.value = { label: detected.format === 'WEEKLY_GRID' ? 'Weekly grid detected (beta)' : 'Registered courses detected', progress: 1 }
    if (detected.format === 'UNKNOWN') { pastedText.value = extraction.text; localError.value = 'The format was uncertain. Review the extracted text below, edit it if needed, then continue.'; return }
    const source = detected.format === 'WEEKLY_GRID' ? 'NTU_TIMETABLE_IMAGE' : file.type === 'application/pdf' ? 'NTU_REGISTERED_COURSES_PDF' : 'NTU_REGISTERED_COURSES_IMAGE'
    await createReview(detected.format === 'WEEKLY_GRID' ? parseNtuGrid(words, source, blocks) : parseNtuRegisteredCourses(extraction.text, source))
  } catch (cause) { if (cause?.name !== 'AbortError') localError.value = cause.message || 'The file could not be read.' } finally { processing.value = false; controller.value = null; event.target.value = '' }
}
</script>
<template>
  <main class="app-page import-page">
    <header class="app-page__header"><div><p class="app-page__eyebrow">Browser-only extraction</p><h1>Import your timetable</h1><span>Upload a STARS timetable, registered-courses summary, or paste the timetable text.</span></div></header>
    <p class="privacy-callout"><UIcon name="i-lucide-shield-check" /> Your file is processed in your browser. Northstar only saves the modules and class sessions you confirm.</p>
    <div v-if="localError || error" class="module-alert" role="alert"><p>{{ localError || error }}</p><UButton v-if="draftCandidate" size="sm" color="neutral" variant="outline" :loading="saving" @click="retryDraft">Retry saved extraction</UButton></div>
    <section class="import-options" aria-label="Import options">
      <label class="import-option"><UIcon name="i-lucide-file-text" /><strong>Upload PDF</strong><span>PDF · up to 10 MB and 10 pages</span><input type="file" accept="application/pdf" :disabled="processing" @change="processFile"></label>
      <label class="import-option"><UIcon name="i-lucide-image" /><strong>Upload screenshot</strong><span>PNG, JPEG or WebP · up to 10 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" :disabled="processing" @change="processFile"></label>
      <a href="#paste-timetable" class="import-option"><UIcon name="i-lucide-clipboard-paste" /><strong>Paste text</strong><span>Useful when OCR needs help</span></a>
    </section>
    <div v-if="processing" class="processing-card" role="status" aria-live="polite"><p>{{ progress.label }}</p><UProgress :model-value="Math.round(progress.progress * 100)" /><UButton color="neutral" variant="outline" @click="controller?.abort()">Cancel</UButton></div>
    <p class="import-recommendation">The registered-courses summary is generally easier to review than a timetable grid. Weekly-grid detection is beta and may leave end times blank for you to confirm.</p>
    <section id="paste-timetable" class="dossier-section"><div class="dossier-section__heading"><div><p>Text fallback</p><h2>Paste timetable text</h2></div></div><textarea v-model="pastedText" rows="12" placeholder="Paste the registered-course table or timetable lines here…" /><div class="module-form__actions"><UButton :disabled="!pastedText.trim()" :loading="saving" @click="parsePasted">Extract for review</UButton></div></section>
  </main>
</template>
