<script setup>
import { hasActiveModules } from '~/utils/module-view'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Modules · Northstar', description: 'Manage the modules in your active semester.' })

const { state, loading, error, load } = useModules()
const { user } = useCurrentSession()
const addOpen = ref(false)
const successMessage = ref('')
const hasModules = computed(() => hasActiveModules(state.value))
watch(user, (currentUser) => {
  if (currentUser) void load().catch(() => {})
}, { immediate: true })

function moduleCreated(module) {
  successMessage.value = `${module.code} was added to your semester.`
}
</script>

<template>
  <main class="app-page modules-page">
    <header class="app-page__header">
      <div><p class="app-page__eyebrow">Academic structure</p><h1>Set up your semester</h1><span>Upload your STARS timetable or registered-courses summary. Northstar will detect your modules and class sessions for review.</span></div>
      <UButton to="/app/timetable/import" icon="i-lucide-upload" size="lg">Import NTU timetable</UButton>
    </header>

    <p v-if="successMessage" class="module-success" role="status" aria-live="polite">{{ successMessage }}</p>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <div v-if="!state" class="module-list-skeleton" aria-label="Loading modules" aria-live="polite">
      <div v-for="item in 3" :key="item" class="app-skeleton app-skeleton--module"><span /><span /><span /></div>
    </div>

    <section v-else-if="!hasModules" class="module-empty">
      <span class="module-empty__icon" aria-hidden="true"><UIcon name="i-lucide-library-big" /></span>
      <p>Set up your active semester</p>
      <h2>Set up your semester</h2>
      <span>Upload your STARS timetable or registered-courses summary. Northstar will detect your modules and class sessions for review.</span>
      <div class="header-actions"><UButton to="/app/timetable/import" size="lg" icon="i-lucide-upload">Import NTU timetable</UButton><UButton color="neutral" variant="outline" @click="addOpen = true">Add manually</UButton></div>
    </section>

    <section v-else aria-labelledby="current-modules-title">
      <div class="modules-list__heading"><div><p>{{ state.semester.label }}</p><h2 id="current-modules-title">Current modules</h2></div><div class="header-actions"><UButton color="neutral" variant="outline" @click="addOpen = true">Search saved modules</UButton><span>{{ state.activeCount }} active</span></div></div>
      <div class="modules-list"><ModulesModuleCard v-for="module in state.modules" :key="module.enrolmentId" :module="module" /></div>
    </section>

    <ModulesAddModuleModal v-model:open="addOpen" @created="moduleCreated" />
  </main>
</template>
