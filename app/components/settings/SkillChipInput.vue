<script setup>
import {
  addSkillChip,
  MAX_SKILL_GOALS,
  MAX_SKILL_LENGTH,
  removeSkillChip,
  uniqueSkillChips,
} from '~/utils/skill-chips'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])
const draft = ref('')
const message = ref('')

const skills = computed(() =>
  uniqueSkillChips(props.modelValue),
)

function commitDraft() {
  const value = draft.value.trim()
  message.value = ''

  if (!value) return
  if (value.length > MAX_SKILL_LENGTH) {
    message.value = `Use ${MAX_SKILL_LENGTH} characters or fewer.`
    return
  }
  if (skills.value.length >= MAX_SKILL_GOALS) {
    message.value = `Use no more than ${MAX_SKILL_GOALS} skills.`
    return
  }

  const next = addSkillChip(skills.value, value)
  if (next.length === skills.value.length) {
    message.value = 'That skill is already selected.'
    return
  }

  emit('update:modelValue', next)
  draft.value = ''
}

function handleKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commitDraft()
    return
  }

  if (
    event.key === 'Backspace'
    && !draft.value
    && skills.value.length
  ) {
    emit(
      'update:modelValue',
      skills.value.slice(0, -1),
    )
  }
}

function remove(skill) {
  emit(
    'update:modelValue',
    removeSkillChip(skills.value, skill),
  )
  message.value = ''
}
</script>

<template>
  <div class="skill-chip-field">
    <label for="opportunity-skill-goal">Skill goals</label>
    <div
      class="skill-chip-input"
      :class="{ 'skill-chip-input--populated': skills.length }"
    >
      <span
        v-for="skill in skills"
        :key="skill.toLocaleLowerCase()"
        class="skill-chip"
      >
        {{ skill }}
        <button
          type="button"
          :aria-label="`Remove ${skill}`"
          @click="remove(skill)"
          @keydown.delete.prevent="remove(skill)"
        >
          <UIcon name="i-lucide-x" aria-hidden="true" />
        </button>
      </span>
      <input
        id="opportunity-skill-goal"
        v-model="draft"
        type="text"
        :maxlength="MAX_SKILL_LENGTH"
        placeholder="+ Add skill"
        aria-describedby="opportunity-skill-help opportunity-skill-message"
        @keydown="handleKeydown"
        @blur="commitDraft"
      >
    </div>
    <small id="opportunity-skill-help">
      Press Enter or comma to add a custom skill. Backspace removes the last chip.
    </small>
    <small
      id="opportunity-skill-message"
      class="skill-chip-field__message"
      aria-live="polite"
    >
      {{ message }}
    </small>
  </div>
</template>
