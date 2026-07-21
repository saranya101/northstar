import { listTimetable } from '../../services/timetable'
import { handleTimetableError, requireTimetableUser } from '../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { return await listTimetable((await requireTimetableUser(event)).id) } catch (error) { return handleTimetableError(event, error, 'Listing timetable') } })

