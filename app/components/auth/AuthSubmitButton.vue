<script setup>
const props = defineProps({
  label: {
    type: String,
    required: true
  },
  loadingLabel: {
    type: String,
    required: true
  },
  pending: Boolean
})
</script>

<template>
  <UButton
    type="submit"
    block
    size="xl"
    :loading="pending"
    :disabled="pending"
    class="auth-submit"
    :ui="{
      base: 'min-h-12 justify-center rounded-lg bg-[var(--ns-accent)] font-semibold text-white shadow-none hover:bg-[var(--ns-accent-hover)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--ns-focus)_38%,transparent)] disabled:cursor-not-allowed'
    }"
  >
    {{ pending ? loadingLabel : label }}
  </UButton>
</template>

<style scoped>
.auth-submit {
  transition: background-color 160ms ease, transform 160ms ease;
}

.auth-submit:not(:disabled):active {
  transform: translateY(1px);
}

@media (prefers-reduced-motion: reduce) {
  .auth-submit {
    transition: none;
  }
}
</style>
