<script setup>
import { createManualModuleSchema, enrolExistingModuleSchema, INSTRUCTOR_ROLES } from '~~/shared/schemas/modules'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open', 'created'])
const { search, searchResults, searching, saving, error, fieldErrors, addManual, enrol, clearErrors } = useModules()

const mode = ref('find')
const searchText = ref('')
const selected = ref(null)
const localErrors = ref({})
const findForm = reactive({ sectionLabel: '', targetGrade: '', colour: 'MINERAL' })
const manualForm = reactive({
  code: '', title: '', description: '', academicUnits: '', sectionLabel: '', targetGrade: '', colour: 'MINERAL',
  lecturerName: '', lecturerRole: 'LECTURER', lecturerTitle: '', lecturerEmail: '', lecturerProfileUrl: ''
})
let debounceTimer

watch(searchText, (value) => {
  clearTimeout(debounceTimer)
  selected.value = null
  if (value.trim().length < 2) return
  debounceTimer = setTimeout(() => search(value), 280)
})
watch(() => props.open, (open) => {
  if (open) {
    clearErrors()
    localErrors.value = {}
  }
})
onBeforeUnmount(() => clearTimeout(debounceTimer))

function validate(schema, payload) {
  const result = schema.safeParse(payload)
  localErrors.value = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [issue.path.at(-1), issue.message]))
  return result
}

async function submitExisting() {
  const result = validate(enrolExistingModuleSchema, { moduleId: selected.value?.id || '', ...findForm })
  if (!result.success) return
  const created = await enrol(result.data)
  if (created) finish(created)
}

async function submitManual() {
  const result = validate(createManualModuleSchema, manualForm)
  if (!result.success) return
  const created = await addManual(result.data)
  if (created) finish(created)
}

function finish(created) {
  emit('created', created)
  emit('update:open', false)
}

function issue(name) {
  return localErrors.value[name] || fieldErrors.value[name]
}
</script>

<template>
  <UModal :open="open" title="Add module" description="Add a shared catalogue module or enter one yourself." scrollable :ui="{ content: 'sm:max-w-3xl' }" @update:open="$emit('update:open', $event)">
    <template #body>
      <div class="module-mode" role="tablist" aria-label="Add module method">
        <button type="button" role="tab" :aria-selected="mode === 'find'" :class="{ 'is-active': mode === 'find' }" @click="mode = 'find'">Find module</button>
        <button type="button" role="tab" :aria-selected="mode === 'manual'" :class="{ 'is-active': mode === 'manual' }" @click="mode = 'manual'">Add manually</button>
      </div>

      <p v-if="error" class="module-alert" role="alert" aria-live="assertive">{{ error }}</p>

      <form v-if="mode === 'find'" class="module-form" @submit.prevent="submitExisting">
        <div class="module-field">
          <label for="module-search">Module code or title</label>
          <UInput id="module-search" v-model="searchText" icon="i-lucide-search" size="lg" placeholder="Enter at least 2 characters" :loading="searching" autocomplete="off" />
          <small v-if="searchText && searchText.trim().length < 2">Enter at least 2 characters.</small>
        </div>
        <div v-if="searchText.trim().length >= 2 && !searching" class="module-search-results" aria-live="polite">
          <p v-if="!searchResults.length">No catalogue modules match this search. You can add the module manually.</p>
          <button v-for="result in searchResults" :key="result.id" type="button" :disabled="result.alreadyEnrolled" :class="{ 'is-selected': selected?.id === result.id }" @click="selected = result">
            <span><strong>{{ result.code }}</strong>{{ result.title }}</span>
            <small>{{ result.alreadyEnrolled ? 'Already enrolled' : result.sourceStatus.replaceAll('_', ' ') }}</small>
          </button>
        </div>
        <p v-if="issue('moduleId')" class="module-field-error">{{ issue('moduleId') }}</p>
        <div class="module-form__grid">
          <div class="module-field"><label for="find-section">Section <em>optional</em></label><UInput id="find-section" v-model="findForm.sectionLabel" maxlength="50" /></div>
          <div class="module-field"><label for="find-grade">Target grade <em>optional</em></label><UInput id="find-grade" v-model="findForm.targetGrade" maxlength="10" /></div>
        </div>
        <ModulesModuleColourPicker v-model="findForm.colour" />
        <div class="module-form__actions"><UButton type="submit" size="lg" :loading="saving" :disabled="!selected || selected.alreadyEnrolled">Enrol in module</UButton></div>
      </form>

      <form v-else class="module-form" @submit.prevent="submitManual">
        <p class="module-note"><strong>User-entered record.</strong> Northstar will not present these details as officially verified.</p>
        <div class="module-form__grid">
          <div class="module-field"><label for="manual-code">Module code</label><UInput id="manual-code" v-model="manualForm.code" :aria-invalid="Boolean(issue('code'))" /><small>{{ issue('code') }}</small></div>
          <div class="module-field"><label for="manual-title">Module title</label><UInput id="manual-title" v-model="manualForm.title" :aria-invalid="Boolean(issue('title'))" /><small>{{ issue('title') }}</small></div>
        </div>
        <div class="module-field"><label for="manual-description">Description <em>optional</em></label><UTextarea id="manual-description" v-model="manualForm.description" :rows="3" maxlength="2000" /><small>{{ issue('description') }}</small></div>
        <div class="module-form__grid module-form__grid--three">
          <div class="module-field"><label for="manual-au">Academic units <em>optional</em></label><UInput id="manual-au" v-model="manualForm.academicUnits" type="number" min="0.01" max="30" step="0.01" /><small>{{ issue('academicUnits') }}</small></div>
          <div class="module-field"><label for="manual-section">Section <em>optional</em></label><UInput id="manual-section" v-model="manualForm.sectionLabel" maxlength="50" /></div>
          <div class="module-field"><label for="manual-grade">Target grade <em>optional</em></label><UInput id="manual-grade" v-model="manualForm.targetGrade" maxlength="10" /></div>
        </div>
        <ModulesModuleColourPicker v-model="manualForm.colour" />
        <fieldset class="module-form__group">
          <legend>Teaching staff <span>optional</span></legend>
          <div class="module-form__grid">
            <div class="module-field"><label for="lecturer-name">Lecturer name</label><UInput id="lecturer-name" v-model="manualForm.lecturerName" /><small>{{ issue('lecturerName') }}</small></div>
            <div class="module-field"><label for="lecturer-role">Role</label><USelect id="lecturer-role" v-model="manualForm.lecturerRole" :items="INSTRUCTOR_ROLES" /></div>
            <div class="module-field"><label for="lecturer-title">Title</label><UInput id="lecturer-title" v-model="manualForm.lecturerTitle" /></div>
            <div class="module-field"><label for="lecturer-email">Email</label><UInput id="lecturer-email" v-model="manualForm.lecturerEmail" type="email" /><small>{{ issue('lecturerEmail') }}</small></div>
          </div>
          <div class="module-field"><label for="lecturer-profile">Official profile URL</label><UInput id="lecturer-profile" v-model="manualForm.lecturerProfileUrl" type="url" placeholder="https://" /><small>{{ issue('lecturerProfileUrl') }}</small></div>
        </fieldset>
        <div class="module-form__actions"><UButton type="submit" size="lg" :loading="saving">Add module</UButton></div>
      </form>
    </template>
  </UModal>
</template>
