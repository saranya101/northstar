<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <NuxtLink to="/" class="auth-brand" aria-label="Northstar home">
    <span class="auth-brand__mark" aria-hidden="true">
      <span />
    </span>
    <span>
      <strong>Northstar</strong>
      <small v-if="!compact">Academic alignment system</small>
    </span>
  </NuxtLink>
</template>

<style scoped>
.auth-brand {
  position: relative;
  z-index: 2;
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  gap: 0.8rem;
  border-radius: 0.5rem;
  color: var(--ns-text);
  text-decoration: none;
}

.auth-brand:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ns-focus) 35%, transparent);
  outline-offset: 4px;
}

.auth-brand__mark {
  position: relative;
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ns-accent) 46%, transparent);
  border-radius: 50%;
}

.auth-brand__mark::before,
.auth-brand__mark::after,
.auth-brand__mark span {
  position: absolute;
  background: var(--ns-accent);
  content: "";
}

.auth-brand__mark::before {
  width: 2px;
  height: 1.05rem;
}

.auth-brand__mark::after {
  width: 1.05rem;
  height: 2px;
}

.auth-brand__mark span {
  width: 0.38rem;
  height: 0.38rem;
  transform: rotate(45deg);
}

strong {
  display: block;
  font-size: 1.15rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

small {
  display: block;
  margin-top: 0.18rem;
  color: var(--ns-text-muted);
  font-size: 0.68rem;
  font-weight: 520;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
