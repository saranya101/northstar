<script setup>
defineProps({ module: { type: Object, required: true } })

function humanize(value) {
  return value?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
}
</script>

<template>
  <article class="module-card">
    <span class="module-card__colour" :class="`module-colour--${module.colour.toLowerCase()}`" aria-hidden="true" />
    <div class="module-card__body">
      <div class="module-card__heading">
        <div><p>{{ module.code }}</p><h2>{{ module.title }}</h2></div>
        <UBadge color="neutral" variant="outline">{{ humanize(module.status) }}</UBadge>
      </div>
      <dl class="module-card__facts">
        <div v-if="module.academicUnits !== null"><dt>Academic units</dt><dd>{{ module.academicUnits }}</dd></div>
        <div><dt>Index number</dt><dd>{{ module.indexNumber || 'Not set' }}</dd></div>
        <div><dt>Registration</dt><dd>{{ humanize(module.registrationStatus) || 'Unknown' }}</dd></div>
        <div><dt>Sessions</dt><dd>{{ module.sessionCount }}</dd></div>
        <div><dt>Open tasks</dt><dd>{{ module.openTaskCount }}</dd></div>
        <div><dt>Coursework attention</dt><dd>{{ module.courseworkAttentionCount }}</dd></div>
        <div><dt>Known graded weight</dt><dd>{{ module.knownGradedWeight }}%</dd></div>
      </dl>
      <p class="module-card__instructors"><strong>Next:</strong> {{ module.nextAssessment ? `${module.nextAssessment.name}${module.nextAssessment.date ? ` · ${new Date(module.nextAssessment.date).toLocaleDateString()}` : ''}` : module.nextClass ? `${humanize(module.nextClass.dayOfWeek)} ${String(Math.floor(module.nextClass.startMinutes / 60)).padStart(2,'0')}:${String(module.nextClass.startMinutes % 60).padStart(2,'0')}` : 'No dated assessment or class' }}</p>
      <p v-if="module.instructors.length" class="module-card__instructors">
        {{ module.instructors.map(item => `${item.fullName} · ${humanize(item.role)}`).join(', ') }}
      </p>
      <div class="module-card__footer">
        <span>{{ humanize(module.sourceStatus) }}</span>
        <UButton :to="`/app/modules/${module.enrolmentId}`" color="primary" variant="soft" trailing-icon="i-lucide-arrow-right">Open dossier</UButton>
      </div>
    </div>
  </article>
</template>
