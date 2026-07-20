<script setup>
const props = defineProps({
  autocomplete: String,
  error: String,
  hint: String,
  inputmode: String,
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
  },
  required: Boolean,
  type: {
    type: String,
    default: 'text'
  }
})

const emit = defineEmits(['blur', 'update:modelValue'])
const messageId = computed(() => `${props.name}-message`)
</script>

<template>
  <div class="auth-field">
    <label :for="name" class="auth-field__label">
      {{ label }}
      <span v-if="required" aria-hidden="true">*</span>
    </label>
    <UInput
      :id="name"
      :model-value="modelValue"
      :name="name"
      :type="type"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :required="required"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || hint ? messageId : undefined"
      size="xl"
      color="neutral"
      variant="outline"
      class="w-full"
      :ui="{
        base: 'min-h-12 rounded-lg bg-white text-[var(--ns-text)] ring-[var(--ns-border)] placeholder:text-[var(--ns-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ns-focus)]'
      }"
      @update:model-value="emit('update:modelValue', $event)"
      @blur="emit('blur', $event)"
    />
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
