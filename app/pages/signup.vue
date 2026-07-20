<script setup>
import { normaliseAuthError } from '~/utils/auth-error'
import { signUpEmail } from '~/utils/auth-client'
import { firstValidationError, signupSchema } from '~/utils/auth-validation'

definePageMeta({ middleware: 'guest' })

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const errorMessage = ref('')
const submitting = ref(false)
const { loadSession, user } = useCurrentSession()

async function submit() {
  if (submitting.value) {
    return
  }

  errorMessage.value = ''
  const validation = signupSchema.safeParse(form)

  if (!validation.success) {
    errorMessage.value = firstValidationError(validation)
    return
  }

  submitting.value = true

  try {
    const { confirmPassword: _, ...credentials } = validation.data
    const { error } = await signUpEmail(credentials)

    if (error) {
      errorMessage.value = normaliseAuthError(error)
      return
    }

    await loadSession(true)

    if (user.value) {
      await navigateTo('/app')
      return
    }

    errorMessage.value = 'Account created. Log in to continue.'
  } catch (error) {
    errorMessage.value = normaliseAuthError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
    <section class="w-full">
      <h1 class="text-3xl font-semibold tracking-tight">
        Create your Northstar account
      </h1>

      <form class="mt-8 space-y-5" @submit.prevent="submit">
        <UFormField label="Full name" name="name" required>
          <UInput v-model="form.name" autocomplete="name" class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email" required>
          <UInput
            v-model="form.email"
            autocomplete="email"
            inputmode="email"
            type="email"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput
            v-model="form.password"
            autocomplete="new-password"
            type="password"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Confirm password" name="confirmPassword" required>
          <UInput
            v-model="form.confirmPassword"
            autocomplete="new-password"
            type="password"
            class="w-full"
          />
        </UFormField>

        <p v-if="errorMessage" role="alert" class="text-sm text-error">
          {{ errorMessage }}
        </p>

        <UButton type="submit" block :loading="submitting" :disabled="submitting">
          Create account
        </UButton>
      </form>

      <p class="mt-6 text-sm text-muted">
        Already have an account?
        <NuxtLink to="/login" class="text-primary hover:underline">
          Log in
        </NuxtLink>
      </p>
    </section>
  </main>
</template>
