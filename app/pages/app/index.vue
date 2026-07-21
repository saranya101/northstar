<script setup>
import { activeModuleCount, hasActiveModules } from '~/utils/module-view'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Overview · Northstar', description: 'Your current academic foundation in Northstar.' })

const { user } = useCurrentSession()
const { state: onboarding } = useOnboarding()
const { state: modules, loading: modulesLoading, load: loadModules } = useModules()
const summary = computed(() => ({
  university: onboarding.value?.academicProfile?.university?.name,
  programme: onboarding.value?.academicProfile?.programme?.name,
  term: modules.value?.semester?.label,
  targetGpa: onboarding.value?.semester?.targetSemesterGpa
}))
const hasModules = computed(() => hasActiveModules(modules.value))
const moduleCount = computed(() => activeModuleCount(modules.value))
const profileLoading = computed(() => !onboarding.value)

watch(user, (currentUser) => {
  if (currentUser) void loadModules().catch(() => {})
}, { immediate: true })
</script>

<template>
  <main class="app-page overview-page">
    <header class="app-page__header">
      <div><p class="app-page__eyebrow">Overview</p><h1>Hello, {{ onboarding?.profile?.displayName || user?.name || 'there' }}</h1><span>Your academic foundation, grounded in the records you have added.</span></div>
      <UButton to="/app/modules" icon="i-lucide-library-big" size="lg">Manage modules</UButton>
    </header>

    <section class="overview-summary" aria-labelledby="academic-summary-title">
      <div class="overview-summary__heading"><p>Active semester</p><h2 id="academic-summary-title">Academic profile</h2></div>
      <div v-if="profileLoading || (modulesLoading && !modules)" class="app-skeleton app-skeleton--summary" aria-label="Loading academic profile">
        <span v-for="item in 5" :key="item" />
      </div>
      <dl v-else>
        <div><dt>University</dt><dd>{{ summary.university }}</dd></div>
        <div><dt>Programme</dt><dd>{{ summary.programme }}</dd></div>
        <div><dt>Current semester</dt><dd>{{ summary.term }}</dd></div>
        <div><dt>Target GPA</dt><dd>{{ summary.targetGpa ?? 'Not set' }}</dd></div>
        <div><dt>Active modules</dt><dd>{{ moduleCount }}</dd></div>
      </dl>
    </section>

    <section v-if="!modulesLoading && modules && !hasModules" class="overview-next-step">
      <span aria-hidden="true"><UIcon name="i-lucide-compass" /></span>
      <div><p>Recommended next step</p><h2>Add your first module</h2><p>Module setup gives Northstar the academic structure needed for the timetable and assessment phases that follow.</p></div>
      <UButton to="/app/modules" trailing-icon="i-lucide-arrow-right">Set up modules</UButton>
    </section>

    <section v-else-if="modules && hasModules" class="overview-modules" aria-labelledby="overview-modules-title">
      <div class="overview-modules__heading"><div><p>Current load</p><h2 id="overview-modules-title">Your modules</h2></div><NuxtLink to="/app/modules">View all <UIcon name="i-lucide-arrow-right" /></NuxtLink></div>
      <NuxtLink v-for="module in modules.modules" :key="module.enrolmentId" :to="`/app/modules/${module.enrolmentId}`" class="overview-module-row">
        <span :class="`module-colour--${module.colour.toLowerCase()}`" aria-hidden="true" /><strong>{{ module.code }}</strong><p>{{ module.title }}</p><small>{{ module.targetGrade ? `Target ${module.targetGrade}` : 'No target grade' }}</small><UIcon name="i-lucide-chevron-right" />
      </NuxtLink>
    </section>
  </main>
</template>
