<script setup>
import { normaliseAuthError } from '~/utils/auth-error'
import { signInEmail } from '~/utils/auth-client'
import { safeLocalRedirect } from '~/utils/auth-redirect'
import { firstValidationError, loginSchema } from '~/utils/auth-validation'

definePageMeta({ middleware: 'guest' })

const route = useRoute()
const form = reactive({
  email: '',
  password: ''
})
const errorMessage = ref('')
const submitting = ref(false)
const { loadSession } = useCurrentSession()

async function submit() {
  if (submitting.value) {
    return
  }

  errorMessage.value = ''
  const validation = loginSchema.safeParse(form)

  if (!validation.success) {
    errorMessage.value = firstValidationError(validation)
    return
  }

  submitting.value = true

  try {
    const { error } = await signInEmail(validation.data)

    if (error) {
      errorMessage.value = normaliseAuthError(error)
      return
    }

    await loadSession(true)
    await navigateTo(safeLocalRedirect(route.query.redirect))
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
        Log in to Northstar
      </h1>

      <form class="mt-8 space-y-5" @submit.prevent="submit">
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
            autocomplete="current-password"
            type="password"
            class="w-full"
          />
        </UFormField>

        <p v-if="errorMessage" role="alert" class="text-sm text-error">
          {{ errorMessage }}
        </p>

        <UButton type="submit" block :loading="submitting" :disabled="submitting">
          Log in
        </UButton>
      </form>

      <p class="mt-6 text-sm text-muted">
        New to Northstar?
        <NuxtLink to="/signup" class="text-primary hover:underline">
          Create an account
        </NuxtLink>
      </p>
    </section>
  </main>
</template>
