import { getToday } from '../services/today'
import { requireAuth } from '../utils/require-auth'
export default defineEventHandler(async event => getToday((await requireAuth(event)).user.id))
