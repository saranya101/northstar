<script setup>
const { state: onboarding } = useOnboarding()
const { user } = useCurrentSession()
const { logout, signingOut, signOutError } = useAuthActions()
const mobileOpen = ref(false)
const navigation = [
  { label: 'Overview', to: '/app', icon: 'i-lucide-layout-dashboard' },
  { label: 'Modules', to: '/app/modules', icon: 'i-lucide-library-big' },
  { label: 'Settings', to: '/app/settings', icon: 'i-lucide-settings-2' }
]
const termLabel = computed(() => {
  const term = onboarding.value?.semester?.academicTerm
  return term ? `${term.academicYear} · ${term.name}` : 'No active semester'
})
</script>

<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar" aria-label="Application navigation">
      <NuxtLink to="/app" class="app-shell__brand"><span aria-hidden="true">N</span><strong>Northstar</strong></NuxtLink>
      <p class="app-shell__term">{{ termLabel }}</p>
      <nav class="app-shell__nav">
        <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" :aria-label="item.label">
          <UIcon :name="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <div class="app-shell__account">
        <span>{{ onboarding?.profile?.displayName || user?.name || user?.email }}</span>
        <button type="button" :disabled="signingOut" @click="logout">{{ signingOut ? 'Signing out…' : 'Log out' }}</button>
        <p v-if="signOutError" role="alert">{{ signOutError }}</p>
      </div>
    </aside>

    <header class="app-shell__mobile-bar">
      <NuxtLink to="/app" class="app-shell__brand"><span aria-hidden="true">N</span><strong>Northstar</strong></NuxtLink>
      <UButton icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Open navigation" @click="mobileOpen = true" />
    </header>

    <USlideover v-model:open="mobileOpen" title="Northstar navigation" side="left" :ui="{ content: 'max-w-72' }">
      <template #body>
        <p class="app-shell__term">{{ termLabel }}</p>
        <nav class="app-shell__nav">
          <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" @click="mobileOpen = false">
            <UIcon :name="item.icon" aria-hidden="true" /><span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </template>
      <template #footer>
        <UButton block color="neutral" variant="outline" :loading="signingOut" @click="logout">Log out</UButton>
      </template>
    </USlideover>

    <div class="app-shell__content"><slot /></div>
  </div>
</template>
