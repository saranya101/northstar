<script setup>
import { protectedRouteDestination } from '~/utils/auth-navigation'
import { appOnboardingDestination } from '~/utils/onboarding-navigation'

const route = useRoute()
const nuxtApp = useNuxtApp()
const { state: onboarding, load: loadOnboarding } = useOnboarding()
const { state: session, user, loadSession } = useCurrentSession()
const { logout, signingOut, signOutError } = useAuthActions()
const mobileOpen = ref(false)
const bootstrapPending = ref(!session.value.loaded || !onboarding.value)
const navigation = [
  { label: 'Overview', to: '/app', icon: 'i-lucide-layout-dashboard' },
  { label: 'Modules', to: '/app/modules', icon: 'i-lucide-library-big' },
  { label: 'Settings', to: '/app/settings', icon: 'i-lucide-settings-2' }
]
const termLabel = computed(() => {
  const term = onboarding.value?.semester?.academicTerm
  if (term) return `${term.academicYear} · ${term.name}`
  return bootstrapPending.value ? 'Loading semester…' : 'No active semester'
})
const accountLabel = computed(() => onboarding.value?.profile?.displayName || user.value?.name || user.value?.email || 'Loading account…')

async function bootstrapApp() {
  try {
    await loadSession()
    const authDestination = protectedRouteDestination(user.value, route.fullPath)
    if (authDestination) {
      await nuxtApp.runWithContext(() => navigateTo(authDestination))
      return
    }

    await loadOnboarding()
    const onboardingDestination = appOnboardingDestination(onboarding.value?.onboardingCompleted, route.path)
    if (onboardingDestination) {
      await nuxtApp.runWithContext(() => navigateTo(onboardingDestination))
    }
  } catch {
    // The composables expose request errors to the page; keep the shell usable.
  } finally {
    bootstrapPending.value = false
  }
}

onMounted(() => { void bootstrapApp() })
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
        <span>{{ accountLabel }}</span>
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

    <div class="app-shell__content">
      <div v-if="bootstrapPending" class="app-shell__loading" role="status" aria-live="polite">
        <span aria-hidden="true" /> Preparing your workspace…
      </div>
      <slot />
    </div>
  </div>
</template>
