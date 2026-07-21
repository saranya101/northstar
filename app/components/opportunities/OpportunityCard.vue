<script setup>
import { OPPORTUNITY_CATEGORY_LABELS, OPPORTUNITY_STATUS_LABELS, opportunityTiming } from '~~/shared/utils/opportunities'
const props = defineProps({ opportunity: { type: Object, required: true } })
const timing = computed(() => opportunityTiming(props.opportunity))
</script>

<template>
  <NuxtLink :to="`/app/opportunities/${opportunity.id}`" class="opportunity-card">
    <div class="opportunity-card__top"><UBadge color="neutral" variant="soft">{{ OPPORTUNITY_CATEGORY_LABELS[opportunity.category] }}</UBadge><span :class="`deadline-state deadline-state--${timing.state}`">{{ timing.label }}</span></div>
    <div><h3>{{ opportunity.title }}</h3><p>{{ opportunity.organisation }}</p></div>
    <dl><div><dt>Location</dt><dd>{{ opportunity.location || opportunity.mode.replaceAll('_', ' ') }}</dd></div><div><dt>Status</dt><dd>{{ OPPORTUNITY_STATUS_LABELS[opportunity.personal?.status] }}</dd></div></dl>
    <div v-if="opportunity.tags.length" class="opportunity-tags"><span v-for="tag in opportunity.tags.slice(0, 4)" :key="tag">{{ tag }}</span></div>
  </NuxtLink>
</template>
