<script setup>
const { loadSession, user } = useCurrentSession()
await loadSession()
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
    <div>
      <h1 class="text-4xl font-semibold tracking-tight">
        Northstar
      </h1>
      <p class="mt-4 max-w-2xl text-lg text-muted">
        A behavioural academic operating system for university students.
      </p>
      <nav class="mt-8 flex gap-4" aria-label="Account">
        <UButton v-if="user" to="/app">
          Open app
        </UButton>
        <template v-else>
          <UButton to="/login">
            Log in
          </UButton>
          <UButton to="/signup" color="neutral" variant="outline">
            Sign up
          </UButton>
        </template>
      </nav>
    </div>
  </main>
</template>
