<template>
  <section class="auth-panel" aria-labelledby="auth-page-title">
    <slot />
  </section>
</template>

<style scoped>
.auth-panel {
  width: min(100%, 470px);
  border: 1px solid var(--ns-border);
  border-radius: 1.15rem;
  padding: clamp(1.5rem, 3vw, 2rem);
  background: var(--ns-panel);
  box-shadow: var(--ns-shadow);
}

@media (max-width: 430px) {
  .auth-panel {
    border-radius: 0.9rem;
    padding: 1.35rem 1.1rem 1.5rem;
    box-shadow: 0 12px 32px rgba(29, 41, 37, 0.08);
  }
}
</style>
