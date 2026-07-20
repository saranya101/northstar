<script setup>
const { logout, signingOut } = useAuthActions()
</script>

<template>
  <div class="onboarding-layout">
    <header class="onboarding-layout__bar">
      <NuxtLink to="/" class="onboarding-layout__brand" aria-label="Northstar home"><span aria-hidden="true">N</span>Northstar</NuxtLink>
      <button type="button" :disabled="signingOut" @click="logout">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
    </header>
    <main class="onboarding-layout__main"><slot /></main>
  </div>
</template>
