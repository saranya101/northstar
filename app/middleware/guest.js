export default defineNuxtRouteMiddleware(async () => {
  const { loadSession, user } = useCurrentSession()
  const { state, load } = useOnboarding()
  await loadSession()

  if (!user.value) return
  await load()
  return navigateTo(state.value?.onboardingCompleted ? '/app' : '/onboarding')
})
