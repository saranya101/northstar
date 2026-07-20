<script setup>
const route = useRoute()
const signupActive = computed(() => route.path === '/signup')
</script>

<template>
  <nav class="auth-tabs" aria-label="Authentication mode">
    <span class="auth-tabs__indicator" :class="{ 'auth-tabs__indicator--signup': signupActive }" aria-hidden="true" />
    <NuxtLink to="/login" :aria-current="!signupActive ? 'page' : undefined">
      Sign in
    </NuxtLink>
    <NuxtLink to="/signup" :aria-current="signupActive ? 'page' : undefined">
      Sign up
    </NuxtLink>
  </nav>
</template>

<style scoped>
.auth-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--ns-border);
}

.auth-tabs a {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 44px;
  place-items: center;
  color: var(--ns-text-muted);
  font-size: 0.9rem;
  font-weight: 590;
  text-decoration: none;
  transition: color 160ms ease;
}

.auth-tabs a[aria-current="page"] {
  color: var(--ns-text);
}

.auth-tabs a:focus-visible {
  border-radius: 0.4rem 0.4rem 0 0;
  outline: 3px solid color-mix(in srgb, var(--ns-focus) 35%, transparent);
  outline-offset: -2px;
}

.auth-tabs__indicator {
  position: absolute;
  z-index: 2;
  width: 50%;
  height: 2px;
  left: 0;
  bottom: -1px;
  border-radius: 999px;
  background: var(--ns-accent);
  transform: translateX(0);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-tabs__indicator--signup {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .auth-tabs__indicator,
  .auth-tabs a {
    transition: none;
  }
}
</style>
