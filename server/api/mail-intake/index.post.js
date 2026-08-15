import { createMailIntakeSchema } from '#shared/schemas/mail-intake'
import { createMailIntake } from '../../services/mail-intakes'
import { readMailIntakeBody, requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => createMailIntake(
  (await requireMailIntakeUser(event)).id,
  await readMailIntakeBody(event, createMailIntakeSchema)
))
