import { linkExtractionResultSchema, parseOpportunityLinkSchema } from '~~/shared/schemas/opportunities'
import { fetchPublicHtml } from '../../services/opportunity-link-fetcher'
import { extractOpportunityFromHtml } from '../../services/opportunity-link-parser'
import { prisma } from '../../utils/prisma'
import { handleOpportunityError, readOpportunityBody, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    const { url } = await readOpportunityBody(event, parseOpportunityLinkSchema)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { timezone: true } })
    const { html, finalUrl } = await fetchPublicHtml(url)
    const result = extractOpportunityFromHtml(html, finalUrl, { timeZone: profile?.timezone || 'Asia/Singapore' })
    return linkExtractionResultSchema.parse(result)
  } catch (error) { return handleOpportunityError(event, error, 'Parsing an opportunity link') }
})
