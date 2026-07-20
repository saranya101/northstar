import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    return { status: 'healthy' }
  } catch {
    console.error('[database-health] Database connectivity check failed')
    setResponseStatus(event, 503)

    return { status: 'unhealthy' }
  }
})
