import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client'

const prismaKey = Symbol.for('northstar.prisma')

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialise the database client')
  }

  const adapter = new PrismaNeon({ connectionString })

  return new PrismaClient({ adapter })
}

export const prisma = globalThis[prismaKey] ?? createPrismaClient()

if (import.meta.dev) {
  globalThis[prismaKey] = prisma
}
