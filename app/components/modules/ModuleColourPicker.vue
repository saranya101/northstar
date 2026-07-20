<script setup>
import { MODULE_COLOURS } from '~~/shared/schemas/modules'

defineProps({ modelValue: { type: String, required: true } })
defineEmits(['update:modelValue'])
</script>

<template>
  <fieldset class="module-colours">
    <legend>Module colour</legend>
    <label v-for="colour in MODULE_COLOURS" :key="colour" :class="`module-colour--${colour.toLowerCase()}`">
      <input :checked="modelValue === colour" type="radio" name="module-colour" :value="colour" @change="$emit('update:modelValue', colour)">
      <span aria-hidden="true" />{{ colour.charAt(0) + colour.slice(1).toLowerCase() }}
    </label>
  </fieldset>
</template>
