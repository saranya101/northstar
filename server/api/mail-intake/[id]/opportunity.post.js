import { getRouterParam } from 'h3'
import { convertMailOpportunitySchema } from '#shared/schemas/mail-intake'
import { convertMailToOpportunity } from '../../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../../utils/mail-intake-request'

export default defineEventHandler(async event => convertMailToOpportunity(
  (await requireMailIntakeUser(event)).id,
  getRouterParam(event, 'id'),
  await readMailIntakeBody(event, convertMailOpportunitySchema)
))
