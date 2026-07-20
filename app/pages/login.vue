<script setup>
import { normaliseAuthError } from '~/utils/auth-error'
import { signInEmail } from '~/utils/auth-client'
import { safeLocalRedirect } from '~/utils/auth-redirect'
import { authenticatedLanding } from '~/utils/onboarding-navigation'
import { loginSchema, validationErrors } from '~/utils/auth-validation'

definePageMeta({ layout: 'auth', middleware: 'guest' })

const route = useRoute()
const heading = ref(null)
const form = reactive({
  email: '',
  password: ''
})
const fieldErrors = reactive({
  email: '',
  password: ''
})
const touched = reactive({
  email: false,
  password: false
})
const serverError = ref('')
const submitting = ref(false)
const { loadSession } = useCurrentSession()
const { state: onboarding, load: loadOnboarding } = useOnboarding()

function validateField(field) {
  const errors = validationErrors(loginSchema.safeParse(form))
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
}

function validateForm() {
  const validation = loginSchema.safeParse(form)
  const errors = validationErrors(validation)

  fieldErrors.email = errors.email ?? ''
  fieldErrors.password = errors.password ?? ''
  touched.email = true
  touched.password = true

  return validation
}

async function submit() {
  if (submitting.value) return

  serverError.value = ''
  const validation = validateForm()

  if (!validation.success) return

  submitting.value = true

  try {
    const { error } = await signInEmail(validation.data)

    if (error) {
      serverError.value = normaliseAuthError(error)
      return
    }

    await loadSession(true)
    await loadOnboarding(true)
    await navigateTo(authenticatedLanding(
      onboarding.value?.onboardingCompleted,
      safeLocalRedirect(route.query.redirect)
    ))
  } catch (error) {
    serverError.value = normaliseAuthError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="auth-form-content">
    <header class="auth-form-header">
      <p class="auth-form-eyebrow">Welcome back</p>
      <h1 id="auth-page-title" ref="heading" tabindex="-1" class="auth-form-title focus:outline-none">
        Continue your semester
      </h1>
      <p class="auth-form-description">
        Sign in to return to your plan, progress and academic workspace.
      </p>
    </header>

    <form class="auth-form" novalidate @submit.prevent="submit">
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
        autocomplete="current-password"
        :error="fieldErrors.password"
        @blur="touchField('password')"
        @update:model-value="validateIfTouched('password')"
      />

      <AuthError :message="serverError" />
      <AuthSubmitButton label="Sign in" loading-label="Signing in…" :pending="submitting" />
    </form>

    <p class="auth-route-switch">
      New to Northstar?
      <NuxtLink to="/signup">Create an account</NuxtLink>
    </p>
  </div>
</template>
