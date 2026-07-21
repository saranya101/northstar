import { parseOpportunityTextSchema, pasteTextExtractionResultSchema } from '~~/shared/schemas/opportunities'
import { extractOpportunityFromText } from '../../services/opportunity-text-parser'
import { prisma } from '../../utils/prisma'
import { handleOpportunityError, readOpportunityBody, requireOpportunityUser } from '../../utils/opportunity-request'

export default defineEventHandler(async event => {
  try {
    const user = await requireOpportunityUser(event)
    const { text } = await readOpportunityBody(event, parseOpportunityTextSchema)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { timezone: true } })
    return pasteTextExtractionResultSchema.parse(extractOpportunityFromText(text, { timeZone: profile?.timezone || 'Asia/Singapore' }))
  } catch (error) { return handleOpportunityError(event, error, 'Parsing pasted opportunity text') }
})
