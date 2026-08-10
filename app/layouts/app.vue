<script setup>
import { protectedRouteDestination } from '~/utils/auth-navigation'
import { appOnboardingDestination } from '~/utils/onboarding-navigation'
import '~/assets/css/v2.css'

const route = useRoute()
const nuxtApp = useNuxtApp()
const { state: onboarding, load: loadOnboarding } = useOnboarding()
const { state: session, user, loadSession } = useCurrentSession()
const { logout, signingOut, signOutError } = useAuthActions()
const mobileOpen = ref(false)
const collapsed = ref(false)
const bootstrapPending = ref(!session.value.loaded || !onboarding.value)
const primaryNavigation = [
  { label: 'Today', to: '/app', icon: 'i-lucide-sun' }, { label: 'Modules', to: '/app/modules', icon: 'i-lucide-library-big' },
  { label: 'Tasks', to: '/app/tasks', icon: 'i-lucide-list-checks' }, { label: 'Planner', to: '/app/planner', icon: 'i-lucide-calendar-range' },
  { label: 'Calendar', to: '/app/calendar', icon: 'i-lucide-calendar-days' }, { label: 'Focus', to: '/app/focus', icon: 'i-lucide-timer' },
  { label: 'Inbox', to: '/app/inbox', icon: 'i-lucide-inbox' }
]
const secondaryNavigation = [{ label: 'Timetable', to: '/app/timetable', icon: 'i-lucide-clock-3' }, { label: 'Opportunities', to: '/app/opportunities', icon: 'i-lucide-briefcase-business' }]
const isActive = destination => route.path === destination || (destination !== '/app' && route.path.startsWith(`${destination}/`))
const termLabel = computed(() => { const term = onboarding.value?.semester?.academicTerm; return term ? `${term.academicYear} · ${term.name}` : bootstrapPending.value ? 'Loading…' : 'No active semester' })
const accountLabel = computed(() => onboarding.value?.profile?.displayName || user.value?.name || user.value?.email || 'Account')
async function bootstrapApp() { try { await loadSession(); const authDestination = protectedRouteDestination(user.value, route.fullPath); if (authDestination) return nuxtApp.runWithContext(() => navigateTo(authDestination)); await loadOnboarding(); const destination = appOnboardingDestination(onboarding.value?.onboardingCompleted, route.path); if (destination) await nuxtApp.runWithContext(() => navigateTo(destination)) } catch {} finally { bootstrapPending.value = false } }
onMounted(() => { void bootstrapApp() })
</script>

<template>
  <div class="v2-shell" :class="{ 'is-collapsed': collapsed }">
    <aside class="v2-sidebar" aria-label="Application navigation"><div class="v2-sidebar__top"><NuxtLink to="/app" class="v2-brand" aria-label="Northstar Today"><span>N</span><strong>Northstar</strong></NuxtLink><button type="button" class="v2-collapse" :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'" @click="collapsed = !collapsed"><UIcon :name="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'" /></button></div><p class="v2-term">{{ termLabel }}</p>
      <nav class="v2-nav" aria-label="Primary"><NuxtLink v-for="item in primaryNavigation" :key="item.to" :to="item.to" :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined" :class="{ active: isActive(item.to) }"><UIcon :name="item.icon" /><span>{{ item.label }}</span></NuxtLink></nav>
      <div class="v2-quick"><p>Quick capture</p><NuxtLink to="/app/inbox" aria-label="Paste update"><UIcon name="i-lucide-clipboard-paste" /><span>Paste update</span></NuxtLink><NuxtLink to="/app/tasks?create=1" aria-label="Create task"><UIcon name="i-lucide-plus" /><span>Create task</span></NuxtLink></div>
      <nav class="v2-nav v2-nav--secondary" aria-label="More"><p>More</p><NuxtLink v-for="item in secondaryNavigation" :key="item.to" :to="item.to" :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined" :class="{ active: isActive(item.to) }"><UIcon :name="item.icon" /><span>{{ item.label }}</span></NuxtLink></nav>
      <div class="v2-account"><NuxtLink to="/app/settings" aria-label="Settings" :class="{ active: isActive('/app/settings') }"><UIcon name="i-lucide-settings-2" /><span>Settings</span></NuxtLink><div><span>{{ accountLabel }}</span><button type="button" :disabled="signingOut" @click="logout">{{ signingOut ? 'Signing out…' : 'Log out' }}</button></div><p v-if="signOutError" role="alert">{{ signOutError }}</p></div>
    </aside>
    <header class="v2-mobile-bar"><NuxtLink to="/app" class="v2-brand"><span>N</span><strong>Northstar</strong></NuxtLink><UButton icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Open navigation" @click="mobileOpen = true" /></header>
    <USlideover v-model:open="mobileOpen" title="Northstar navigation" side="left" :ui="{ content: 'max-w-72' }"><template #body><p class="v2-term">{{ termLabel }}</p><nav class="v2-nav"><NuxtLink v-for="item in [...primaryNavigation, ...secondaryNavigation, { label: 'Settings', to: '/app/settings', icon: 'i-lucide-settings-2' }]" :key="item.to" :to="item.to" :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined" :class="{ active: isActive(item.to) }" @click="mobileOpen = false"><UIcon :name="item.icon" /><span>{{ item.label }}</span></NuxtLink></nav></template><template #footer><UButton block color="neutral" variant="outline" :loading="signingOut" @click="logout">Log out</UButton></template></USlideover>
    <div class="v2-workspace"><div v-if="bootstrapPending" class="app-shell__loading" role="status">Preparing your workspace…</div><slot /></div>
  </div>
</template>
