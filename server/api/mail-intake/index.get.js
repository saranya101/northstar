import { listMailIntakes } from '../../services/mail-intakes'
import { requireMailIntakeUser } from '../../utils/mail-intake-request'

export default defineEventHandler(async event => {
  const requested = String(getQuery(event).view || 'active')
  const view = ['active', 'archived', 'dismissed'].includes(requested) ? requested : 'active'
  return listMailIntakes((await requireMailIntakeUser(event)).id, view)
})
import { getQuery } from 'h3'
