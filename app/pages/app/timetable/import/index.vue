<script setup>
import { parseNtuRegisteredCourses } from '~/utils/timetable-import/ntu-registered-courses-parser'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Paste timetable · Northstar' })
const router = useRouter()
const { createImport, saving, error } = useTimetable()
const pastedText = ref('')
const localError = ref('')
async function parsePasted() {
  localError.value = ''
  const candidate = parseNtuRegisteredCourses(pastedText.value, 'PASTED_TEXT')
  if (!candidate.modules.length) { localError.value = candidate.warnings[0] || 'No modules were detected. Paste clearer timetable text.'; return }
  const result = await createImport(candidate)
  if (result) await router.push(`/app/timetable/import/${result.id}`)
}
</script>

<template><main class="app-page v2-page import-page"><header class="v2-page-heading"><div><p>Timetable</p><h1>Paste timetable text</h1></div><span>Northstar structures text in your browser and saves only the review you confirm.</span></header><section class="v2-intake-composer"><div class="v2-section-heading"><div><p>Text intake</p><h2>Registered courses and sessions</h2></div></div><textarea v-model="pastedText" rows="14" placeholder="Paste registered-course or structured timetable text here…" /><p v-if="localError || error" class="module-alert" role="alert">{{ localError || error }}</p><div class="v2-inline-actions"><span>Text-only intake.</span><UButton :disabled="!pastedText.trim()" :loading="saving" @click="parsePasted">Extract for review</UButton></div></section></main></template>
