import { prismaAdapter } from '@better-auth/prisma-adapter'
import { betterAuth } from 'better-auth'
import { prisma } from './prisma'

const secret = process.env.BETTER_AUTH_SECRET
const baseURL = process.env.BETTER_AUTH_URL

if (!secret) {
  throw new Error('BETTER_AUTH_SECRET is required to initialise authentication')
}

if (!baseURL) {
  throw new Error('BETTER_AUTH_URL is required to initialise authentication')
}

export const auth = betterAuth({
  appName: 'Northstar',
  baseURL,
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false
  },
  secret
})
