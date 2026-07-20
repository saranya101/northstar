<script setup>
import { normaliseAuthError } from '~/utils/auth-error'
import { signUpEmail } from '~/utils/auth-client'
import { signupSchema, validationErrors } from '~/utils/auth-validation'

definePageMeta({ layout: 'auth', middleware: 'guest' })

const heading = ref(null)
const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const fieldErrors = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const touched = reactive({
  name: false,
  email: false,
  password: false,
  confirmPassword: false
})
const serverError = ref('')
const submitting = ref(false)
const { loadSession, user } = useCurrentSession()
const { load: loadOnboarding } = useOnboarding()

function validateField(field) {
  const errors = validationErrors(signupSchema.safeParse(form))
  fieldErrors[field] = errors[field] ?? ''
}

function touchField(field) {
  touched[field] = true
  validateField(field)
}

function validateIfTouched(field) {
  if (touched[field]) {
    validateField(field)
  }

  if (field === 'password' && touched.confirmPassword) {
    validateField('confirmPassword')
  }
}

function validateForm() {
  const validation = signupSchema.safeParse(form)
  const errors = validationErrors(validation)

  for (const field of Object.keys(fieldErrors)) {
    fieldErrors[field] = errors[field] ?? ''
    touched[field] = true
  }

  return validation
}

async function submit() {
  if (submitting.value) return

  serverError.value = ''
  const validation = validateForm()

  if (!validation.success) return

  submitting.value = true

  try {
    const { confirmPassword: _, ...credentials } = validation.data
    const { error } = await signUpEmail(credentials)

    if (error) {
      serverError.value = normaliseAuthError(error)
      return
    }

    await loadSession(true)

    if (user.value) {
      await loadOnboarding(true)
      await navigateTo('/onboarding')
      return
    }

    serverError.value = 'Account created. Sign in to continue.'
  } catch (error) {
    serverError.value = normaliseAuthError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="auth-form-content auth-form-content--signup">
    <header class="auth-form-header">
      <p class="auth-form-eyebrow">Start with clarity</p>
      <h1 id="auth-page-title" ref="heading" tabindex="-1" class="auth-form-title focus:outline-none">
        Build your academic system
      </h1>
      <p class="auth-form-description">
        Create your account, then shape Northstar around your semester and goals.
      </p>
    </header>

    <form class="auth-form" novalidate @submit.prevent="submit">
      <AuthField
        v-model="form.name"
        name="name"
        label="Full name"
        autocomplete="name"
        required
        :error="fieldErrors.name"
        @blur="touchField('name')"
        @update:model-value="validateIfTouched('name')"
      />

      <AuthField
        v-model="form.email"
        name="email"
        label="Email address"
        type="email"
        inputmode="email"
        autocomplete="email"
        required
        :error="fieldErrors.email"
        @blur="touchField('email')"
        @update:model-value="validateIfTouched('email')"
      />

      <AuthPasswordField
        v-model="form.password"
        name="password"
        label="Password"
        autocomplete="new-password"
        hint="Use 8–128 characters."
        :error="fieldErrors.password"
        @blur="touchField('password')"
        @update:model-value="validateIfTouched('password')"
      />

      <AuthPasswordField
        v-model="form.confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        autocomplete="new-password"
        :error="fieldErrors.confirmPassword"
        @blur="touchField('confirmPassword')"
        @update:model-value="validateIfTouched('confirmPassword')"
      />

      <AuthError :message="serverError" />
      <AuthSubmitButton label="Create account" loading-label="Creating account…" :pending="submitting" />
    </form>

    <p class="auth-route-switch">
      Already have an account?
      <NuxtLink to="/login">Sign in</NuxtLink>
    </p>
  </div>
</template>
