import { listMailIntakes } from '../../services/mail-intakes'
import { requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => listMailIntakes((await requireMailIntakeUser(event)).id))
