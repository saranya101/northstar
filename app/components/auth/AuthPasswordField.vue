<script setup>
const props = defineProps({
  autocomplete: {
    type: String,
    required: true
  },
  error: String,
  hint: String,
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['blur', 'update:modelValue'])
const visible = ref(false)
const messageId = computed(() => `${props.name}-message`)
const visibilityLabel = computed(() => `${visible.value ? 'Hide' : 'Show'} ${props.label.toLowerCase()}`)
</script>

<template>
  <div class="auth-field">
    <label :for="name" class="auth-field__label">
      {{ label }} <span aria-hidden="true">*</span>
    </label>
    <UInput
      :id="name"
      :model-value="modelValue"
      :name="name"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      required
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || hint ? messageId : undefined"
      size="xl"
      color="neutral"
      variant="outline"
      class="w-full"
      :ui="{
        base: 'min-h-12 rounded-lg bg-white pe-12 text-[var(--ns-text)] ring-[var(--ns-border)] focus-visible:ring-2 focus-visible:ring-[var(--ns-focus)]',
        trailing: 'pe-1.5'
      }"
      @update:model-value="emit('update:modelValue', $event)"
      @blur="emit('blur', $event)"
    >
      <template #trailing>
        <button
          type="button"
          class="auth-password-toggle"
          :aria-label="visibilityLabel"
          :aria-pressed="visible"
          @click="visible = !visible"
        >
          <UIcon :name="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'" aria-hidden="true" />
        </button>
      </template>
    </UInput>
    <div :id="messageId" class="auth-field__message" :class="{ 'auth-field__message--error': error }">
      {{ error || hint || '&nbsp;' }}
    </div>
  </div>
</template>

<style scoped>
.auth-field__label {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: var(--ns-text-secondary);
  font-size: 0.86rem;
  font-weight: 590;
}

.auth-field__label span {
  color: var(--ns-accent);
}

.auth-password-toggle {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.5rem;
  color: var(--ns-text-muted);
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.auth-password-toggle:hover {
  background: var(--ns-accent-soft);
  color: var(--ns-accent);
}

.auth-password-toggle:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ns-focus) 35%, transparent);
  outline-offset: 0;
}

.auth-field__message {
  min-height: 1.15rem;
  margin-top: 0.35rem;
  color: var(--ns-text-muted);
  font-size: 0.76rem;
  line-height: 1.35;
}

.auth-field__message--error {
  color: var(--ns-danger);
}
</style>
