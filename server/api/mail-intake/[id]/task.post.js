import { getRouterParam } from 'h3'
import { convertMailTaskSchema } from '#shared/schemas/mail-intake'
import { convertMailToTask } from '../../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../../utils/mail-intake-request'

export default defineEventHandler(async event => convertMailToTask(
  (await requireMailIntakeUser(event)).id,
  getRouterParam(event, 'id'),
  await readMailIntakeBody(event, convertMailTaskSchema)
))
