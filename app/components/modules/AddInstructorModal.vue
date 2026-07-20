<script setup>
import { createInstructorSchema, INSTRUCTOR_ROLES } from '~~/shared/schemas/modules'

const props = defineProps({ open: Boolean, enrolmentId: { type: String, required: true } })
const emit = defineEmits(['update:open', 'created'])
const { addInstructor, saving, error, fieldErrors, clearErrors } = useModules()
const form = reactive({ fullName: '', role: 'LECTURER', title: '', officialEmail: '', officialProfileUrl: '' })
const localErrors = ref({})

watch(() => props.open, (open) => { if (open) { clearErrors(); localErrors.value = {} } })

async function submit() {
  const result = createInstructorSchema.safeParse(form)
  localErrors.value = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [issue.path.at(-1), issue.message]))
  if (!result.success) return
  const created = await addInstructor(props.enrolmentId, result.data)
  if (created) {
    emit('created')
    emit('update:open', false)
  }
}

function issue(name) {
  return localErrors.value[name] || fieldErrors.value[name]
}
</script>

<template>
  <UModal :open="open" title="Add instructor" description="Add teaching staff to this module offering." @update:open="$emit('update:open', $event)">
    <template #body>
      <form class="module-form" @submit.prevent="submit">
        <p class="module-note"><strong>User-entered record.</strong> This information is not officially verified by Northstar.</p>
        <p v-if="error" class="module-alert" role="alert" aria-live="assertive">{{ error }}</p>
        <div class="module-form__grid">
          <div class="module-field"><label for="instructor-name">Full name</label><UInput id="instructor-name" v-model="form.fullName" autofocus /><small>{{ issue('fullName') }}</small></div>
          <div class="module-field"><label for="instructor-role">Role</label><USelect id="instructor-role" v-model="form.role" :items="INSTRUCTOR_ROLES" /><small>{{ issue('role') }}</small></div>
          <div class="module-field"><label for="instructor-title">Title <em>optional</em></label><UInput id="instructor-title" v-model="form.title" /></div>
          <div class="module-field"><label for="instructor-email">Official email <em>optional</em></label><UInput id="instructor-email" v-model="form.officialEmail" type="email" /><small>{{ issue('officialEmail') }}</small></div>
        </div>
        <div class="module-field"><label for="instructor-url">Official profile URL <em>optional</em></label><UInput id="instructor-url" v-model="form.officialProfileUrl" type="url" placeholder="https://" /><small>{{ issue('officialProfileUrl') }}</small></div>
        <div class="module-form__actions"><UButton type="submit" :loading="saving">Add instructor</UButton></div>
      </form>
    </template>
  </UModal>
</template>
