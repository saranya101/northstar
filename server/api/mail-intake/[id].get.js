import { getRouterParam } from 'h3'
import { getMailIntake, serializeMailIntake } from '../../services/mail-intakes'
import { requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => serializeMailIntake(await getMailIntake(
  (await requireMailIntakeUser(event)).id,
  getRouterParam(event, 'id')
)))
