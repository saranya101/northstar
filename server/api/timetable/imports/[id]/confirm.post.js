import { getRouterParam } from 'h3'
import { confirmTimetableImportSchema } from '~~/shared/schemas/timetable'
import { confirmTimetableImport } from '../../../../services/timetable'
import { handleTimetableError, readTimetableBody, requireTimetableUser } from '../../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { const user = await requireTimetableUser(event); return await confirmTimetableImport(user.id, getRouterParam(event, 'id'), await readTimetableBody(event, confirmTimetableImportSchema)) } catch (error) { return handleTimetableError(event, error, 'Confirming import') } })

