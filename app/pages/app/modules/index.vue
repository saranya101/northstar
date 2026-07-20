<script setup>
import { hasActiveModules } from '~/utils/module-view'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Modules · Northstar', description: 'Manage the modules in your active semester.' })

const { state, loading, error, load } = useModules()
const addOpen = ref(false)
const successMessage = ref('')
const hasModules = computed(() => hasActiveModules(state.value))
await load()

function moduleCreated(module) {
  successMessage.value = `${module.code} was added to your semester.`
}
</script>

<template>
  <main class="app-page modules-page">
    <header class="app-page__header">
      <div><p class="app-page__eyebrow">Academic structure</p><h1>Modules</h1><span>Build the academic structure Northstar will use for your timetable, assessments and progress.</span></div>
      <UButton icon="i-lucide-plus" size="lg" @click="addOpen = true">Add module</UButton>
    </header>

    <p v-if="successMessage" class="module-success" role="status" aria-live="polite">{{ successMessage }}</p>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <div v-if="loading && !state" class="module-loading" aria-live="polite"><UIcon name="i-lucide-loader-circle" class="animate-spin" /> Loading modules…</div>

    <section v-else-if="!hasModules" class="module-empty">
      <span class="module-empty__icon" aria-hidden="true"><UIcon name="i-lucide-library-big" /></span>
      <p>Set up your active semester</p>
      <h2>Your semester starts here</h2>
      <span>Add the modules you are taking so Northstar can organise your timetable, assessments and academic progress.</span>
      <UButton size="lg" icon="i-lucide-plus" @click="addOpen = true">Add module</UButton>
    </section>

    <section v-else aria-labelledby="current-modules-title">
      <div class="modules-list__heading"><div><p>{{ state.semester.label }}</p><h2 id="current-modules-title">Current modules</h2></div><span>{{ state.activeCount }} active</span></div>
      <div class="modules-list"><ModulesModuleCard v-for="module in state.modules" :key="module.enrolmentId" :module="module" /></div>
    </section>

    <ModulesAddModuleModal v-model:open="addOpen" @created="moduleCreated" />
  </main>
</template>
