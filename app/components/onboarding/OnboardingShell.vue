<script setup>
defineProps({ currentStep: { type: Number, required: true } })
</script>

<template>
  <section class="onboarding-workspace">
    <header class="onboarding-workspace__header">
      <div>
        <p class="onboarding-workspace__eyebrow">Academic setup</p>
        <p class="onboarding-workspace__context">Five short steps. Each one saves as you go.</p>
      </div>
      <OnboardingProgress :current-step="currentStep" />
    </header>
    <div class="onboarding-workspace__body"><slot /></div>
  </section>
</template>
