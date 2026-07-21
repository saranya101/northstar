import { getRouterParam } from 'h3'
import { updateTimetableImportSchema } from '~~/shared/schemas/timetable'
import { updateTimetableImport } from '../../../services/timetable'
import { handleTimetableError, readTimetableBody, requireTimetableUser } from '../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { const user = await requireTimetableUser(event); return await updateTimetableImport(user.id, getRouterParam(event, 'id'), await readTimetableBody(event, updateTimetableImportSchema)) } catch (error) { return handleTimetableError(event, error, 'Updating import') } })

