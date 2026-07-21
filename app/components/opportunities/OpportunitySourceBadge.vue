<script setup>
import {
  opportunitySourcePresentation,
} from '~/utils/opportunity-presentation'

const props = defineProps({
  name: {
    type: String,
    default: '',
  },
})

const source = computed(() =>
  opportunitySourcePresentation(props.name),
)
</script>

<template>
  <span
    class="opportunity-source-badge"
    :class="`opportunity-source-badge--${source.key}`"
    :data-source="source.key"
  >
    <UIcon
      :name="source.icon"
      aria-hidden="true"
    />

    <span>{{ source.label }}</span>
  </span>
</template>
