import {
  getHeader,
  setHeader,
  setResponseStatus
} from 'h3'

import {
  runScheduledOpportunitySync
} from '../../opportunity-scanner/scheduled-sync'

import {
  isAuthorizedCronRequest
} from '../../utils/cron-auth'

export default defineEventHandler(async event => {
  setHeader(event, 'cache-control', 'no-store')

  const authorization = getHeader(event, 'authorization')
  const secret = process.env.CRON_SECRET

  if (!isAuthorizedCronRequest(authorization, secret)) {
    setResponseStatus(event, 401)

    return {
      success: false,
      error: 'Unauthorized'
    }
  }

  const result = await runScheduledOpportunitySync()

  if (result.succeededCount === 0) {
    setResponseStatus(event, 503)
  } else if (!result.success) {
    setResponseStatus(event, 207)
  }

  return result
})
