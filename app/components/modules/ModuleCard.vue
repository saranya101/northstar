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
        <div v-if="module.sectionLabel !== 'DEFAULT'"><dt>Section</dt><dd>{{ module.sectionLabel }}</dd></div>
        <div><dt>Target grade</dt><dd>{{ module.targetGrade || 'Not set' }}</dd></div>
      </dl>
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
