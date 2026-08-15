import { getRouterParam } from 'h3'
import { mailDecisionSchema } from '#shared/schemas/mail-intake'
import { archiveMailIntake } from '../../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../../utils/mail-intake-request'

export default defineEventHandler(async event => archiveMailIntake(
  (await requireMailIntakeUser(event)).id,
  getRouterParam(event, 'id'),
  await readMailIntakeBody(event, mailDecisionSchema)
))
