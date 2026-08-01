<script setup>
const props = defineProps({
  summary: { type: Object, required: true },
})

function minutes(seconds) {
  return Math.round((Number(seconds) || 0) / 60)
}
</script>

<template>
  <section class="focus-summary-grid" aria-label="Study time summary">
    <article>
      <span>Today</span>
      <strong>{{ minutes(props.summary.todayFocusedSeconds) }}</strong>
      <small>focused minutes</small>
    </article>
    <article>
      <span>This week</span>
      <strong>{{ minutes(props.summary.weekFocusedSeconds) }}</strong>
      <small>focused minutes</small>
    </article>
    <article>
      <span>Today</span>
      <strong>{{ props.summary.completedSessionsToday }}</strong>
      <small>completed sessions</small>
    </article>
  </section>
</template>
