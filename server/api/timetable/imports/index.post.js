import { createTimetableImportSchema } from '~~/shared/schemas/timetable'
import { createTimetableImport } from '../../../services/timetable'
import { handleTimetableError, readTimetableBody, requireTimetableUser } from '../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { const user = await requireTimetableUser(event); return await createTimetableImport(user.id, await readTimetableBody(event, createTimetableImportSchema)) } catch (error) { return handleTimetableError(event, error, 'Creating import') } })

