import { createMailIntakeSchema } from '#shared/schemas/mail-intake'
import { previewMailPaste } from '../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => {
  await requireMailIntakeUser(event)
  return previewMailPaste(await readMailIntakeBody(event, createMailIntakeSchema))
})
