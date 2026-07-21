<script setup>
import { OPPORTUNITY_CATEGORY_LABELS, OPPORTUNITY_STATUS_LABELS, opportunityTiming } from '~~/shared/utils/opportunities'
const props = defineProps({ opportunity: { type: Object, required: true } })
const timing = computed(() => props.opportunity.isPublic && !props.opportunity.active ? { state: 'closed', label: 'Unavailable' } : opportunityTiming(props.opportunity))
const isNew = computed(() => props.opportunity.isPublic && props.opportunity.firstSeenAt && Date.now() - new Date(props.opportunity.firstSeenAt).getTime() <= 7 * 86_400_000)
</script>

<template>
  <NuxtLink :to="`/app/opportunities/${opportunity.id}`" class="opportunity-card">
    <div class="opportunity-card__top"><div class="opportunity-card__badges"><UBadge color="neutral" variant="soft">{{ OPPORTUNITY_CATEGORY_LABELS[opportunity.category] }}</UBadge><UBadge v-if="isNew" color="primary" variant="soft">New</UBadge></div><span :class="`deadline-state deadline-state--${timing.state}`">{{ timing.label }}</span></div>
    <div><h3>{{ opportunity.title }}</h3><p>{{ opportunity.organisation }}</p></div>
    <dl><div><dt>Location</dt><dd>{{ opportunity.location || opportunity.mode.replaceAll('_', ' ') }}</dd></div><div><dt>Status</dt><dd>{{ OPPORTUNITY_STATUS_LABELS[opportunity.personal?.status] || 'Not tracked' }}</dd></div></dl>
    <p v-if="opportunity.isPublic" class="opportunity-card__source">{{ opportunity.publicSourceNames.join(', ') || opportunity.sourceName }}<span v-if="opportunity.lastVerifiedAt">Verified {{ new Date(opportunity.lastVerifiedAt).toLocaleDateString() }}</span></p>
    <div v-if="opportunity.tags.length" class="opportunity-tags"><span v-for="tag in opportunity.tags.slice(0, 4)" :key="tag">{{ tag }}</span></div>
  </NuxtLink>
</template>
