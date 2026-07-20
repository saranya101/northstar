<script setup>
const props = defineProps({ currentStep: { type: Number, required: true } })
const steps = ['Profile', 'Academic', 'Semester', 'Preferences', 'Ready']
</script>

<template>
  <nav aria-label="Onboarding progress" class="onboarding-progress">
    <p class="onboarding-progress__compact">Step {{ currentStep }} of {{ steps.length }} · {{ steps[currentStep - 1] }}</p>
    <ol>
      <li v-for="(step, index) in steps" :key="step" :class="{ 'is-current': currentStep === index + 1, 'is-complete': currentStep > index + 1 }" :aria-current="currentStep === index + 1 ? 'step' : undefined">
        <span>{{ currentStep > index + 1 ? '✓' : index + 1 }}</span>
        <small>{{ step }}</small>
      </li>
    </ol>
  </nav>
</template>
