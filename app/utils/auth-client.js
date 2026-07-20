import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient()

export const getSession = (...args) => authClient.getSession(...args)
export const signInEmail = (...args) => authClient.signIn.email(...args)
export const signOut = (...args) => authClient.signOut(...args)
export const signUpEmail = (...args) => authClient.signUp.email(...args)
export const useAuthSession = (...args) => authClient.useSession(...args)
