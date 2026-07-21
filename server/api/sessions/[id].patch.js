import { getRouterParam } from 'h3'
import { classSessionUpdateSchema } from '~~/shared/schemas/timetable'
import { updateClassSession } from '../../services/timetable'
import { handleTimetableError, readTimetableBody, requireTimetableUser } from '../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { const user = await requireTimetableUser(event); return await updateClassSession(user.id, getRouterParam(event, 'id'), await readTimetableBody(event, classSessionUpdateSchema)) } catch (error) { return handleTimetableError(event, error, 'Updating session') } })

