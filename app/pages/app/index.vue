<script setup>
definePageMeta({ middleware: 'auth' })

const { loadSession, user } = useCurrentSession()
const { logout, signingOut, signOutError } = useAuthActions()

await loadSession()
</script>

<template>
  <main class="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <h1 class="text-3xl font-semibold tracking-tight">
      Northstar
    </h1>
    <p class="mt-4 text-muted">
      Signed in as {{ user?.name || user?.email }}.
    </p>

    <UButton class="mt-8" :loading="signingOut" :disabled="signingOut" @click="logout">
      Log out
    </UButton>

    <p v-if="signOutError" role="alert" class="mt-4 text-sm text-error">
      {{ signOutError }}
    </p>
  </main>
</template>
