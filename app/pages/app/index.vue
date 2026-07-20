<script setup>
definePageMeta({ middleware: ['auth', 'onboarded'] })

const { loadSession, user } = useCurrentSession()
const { logout, signingOut, signOutError } = useAuthActions()
const { state: onboarding, load: loadOnboarding } = useOnboarding()

await loadSession()
await loadOnboarding()

const summary = computed(() => ({
  university: onboarding.value?.academicProfile?.university?.name,
  programme: onboarding.value?.academicProfile?.programme?.name,
  term: onboarding.value?.semester?.academicTerm?.name,
  targetGpa: onboarding.value?.semester?.targetSemesterGpa
}))
</script>

<template>
  <main class="app-home">
    <header class="app-home__header">
      <div>
        <p class="app-home__eyebrow">Northstar</p>
        <h1>Hello, {{ onboarding?.profile?.displayName || user?.name || user?.email }}</h1>
        <p>Your academic foundation is in place.</p>
      </div>
      <div class="app-home__actions">
        <UButton to="/app/settings" color="neutral" variant="outline">Settings</UButton>
        <UButton color="neutral" variant="ghost" :loading="signingOut" :disabled="signingOut" @click="logout">Log out</UButton>
      </div>
    </header>

    <section class="app-summary" aria-labelledby="academic-summary-title">
      <h2 id="academic-summary-title">Academic profile</h2>
      <dl>
        <div><dt>University</dt><dd>{{ summary.university }}</dd></div>
        <div><dt>Programme</dt><dd>{{ summary.programme }}</dd></div>
        <div><dt>Current semester</dt><dd>{{ summary.term }}</dd></div>
        <div><dt>Target GPA</dt><dd>{{ summary.targetGpa }}</dd></div>
      </dl>
    </section>

    <p class="app-home__notice">Modules will be added in the next phase.</p>

    <p v-if="signOutError" role="alert" class="mt-4 text-sm text-error">
      {{ signOutError }}
    </p>
  </main>
</template>
