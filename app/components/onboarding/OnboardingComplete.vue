<script setup>
defineProps({ state: { type: Object, required: true }, saving: Boolean, serverError: String })
const emit = defineEmits(['back', 'complete'])
</script>

<template>
  <section class="onboarding-form">
    <header class="onboarding-step-heading"><p>Step 5</p><h1>Your foundation is ready</h1><span>Review the essentials. Northstar will use these as the basis for your academic workspace.</span></header>
    <dl class="onboarding-summary">
      <div><dt>University</dt><dd>{{ state.academicProfile?.university?.name }}</dd></div>
      <div><dt>Programme</dt><dd>{{ state.academicProfile?.programme?.name }}</dd></div>
      <div><dt>Current term</dt><dd>{{ state.semester?.academicTerm?.academicYear }} · {{ state.semester?.academicTerm?.name }}</dd></div>
      <div><dt>GPA target</dt><dd>{{ state.semester?.targetSemesterGpa }}</dd></div>
      <div><dt>Typical study session</dt><dd>{{ state.studyPreference?.typicalSessionMinutes }} minutes</dd></div>
    </dl>
    <p v-if="serverError" class="onboarding-alert" role="alert" aria-live="polite">{{ serverError }}</p>
    <div class="onboarding-actions"><button type="button" class="onboarding-secondary" @click="emit('back')">Back</button><button type="button" class="onboarding-primary" :disabled="saving" @click="emit('complete')">{{ saving ? 'Preparing Northstar…' : 'Enter Northstar' }}</button></div>
  </section>
</template>
