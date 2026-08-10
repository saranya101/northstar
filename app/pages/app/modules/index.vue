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
  if (currentUser) void load(true).catch(() => {})
}, { immediate: true })

function moduleCreated(module) {
  successMessage.value = `${module.code} was added to your semester.`
}
</script>

<template>
  <main class="app-page v2-page modules-page">
    <header class="v2-page-heading">
      <div><p>Modules</p><h1>{{ hasModules ? 'Semester status by module' : 'Set up your semester' }}</h1></div>
      <div class="header-actions"><UButton to="/app/timetable/import" color="neutral" variant="outline" icon="i-lucide-clipboard-paste">Paste timetable</UButton><UButton icon="i-lucide-plus" @click="addOpen = true">Add module</UButton></div>
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
      <span>Paste timetable text or add a module manually.</span>
      <div class="header-actions"><UButton to="/app/timetable/import" icon="i-lucide-clipboard-paste">Paste timetable</UButton><UButton color="neutral" variant="outline" @click="addOpen = true">Add manually</UButton></div>
    </section>

    <section v-else aria-labelledby="current-modules-title">
      <div class="modules-list__heading"><div><p>{{ state.semester.label }}</p><h2 id="current-modules-title">Current modules</h2></div><div class="header-actions"><UButton color="neutral" variant="outline" @click="addOpen = true">Search saved modules</UButton><span>{{ state.activeCount }} active</span></div></div>
      <div class="modules-list"><ModulesModuleCard v-for="module in state.modules" :key="module.enrolmentId" :module="module" /></div>
    </section>

    <ModulesAddModuleModal v-model:open="addOpen" @created="moduleCreated" />
  </main>
</template>
