import { createMailBatchSchema } from '#shared/schemas/mail-intake'
import { createMailBatch } from '../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => {
  const user = await requireMailIntakeUser(event)
  const input = await readMailIntakeBody(event, createMailBatchSchema)
  return createMailBatch(user.id, input.messages)
})
