<script setup>
defineProps({
  message: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="auth-error-slot" aria-live="polite" aria-atomic="true">
    <div v-if="message" class="auth-error" role="alert">
      <UIcon name="i-lucide-circle-alert" aria-hidden="true" />
      <span>{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.auth-error-slot {
  min-height: 3rem;
}

.auth-error {
  display: flex;
  min-height: 3rem;
  align-items: flex-start;
  gap: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--ns-danger) 28%, var(--ns-border));
  border-radius: 0.65rem;
  padding: 0.72rem 0.8rem;
  background: var(--ns-danger-soft);
  color: #74332f;
  font-size: 0.82rem;
  line-height: 1.4;
}

.auth-error :deep(svg) {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  margin-top: 0.08rem;
}
</style>
