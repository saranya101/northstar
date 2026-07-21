import { getRouterParam } from 'h3'
import { classSessionCreateSchema } from '~~/shared/schemas/timetable'
import { createClassSession } from '../../../services/timetable'
import { handleTimetableError, readTimetableBody, requireTimetableUser } from '../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { const user = await requireTimetableUser(event); return await createClassSession(user.id, getRouterParam(event, 'id'), await readTimetableBody(event, classSessionCreateSchema)) } catch (error) { return handleTimetableError(event, error, 'Creating session') } })

