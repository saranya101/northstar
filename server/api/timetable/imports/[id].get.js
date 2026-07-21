import { getRouterParam } from 'h3'
import { getTimetableImport } from '../../../services/timetable'
import { handleTimetableError, requireTimetableUser } from '../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { return await getTimetableImport((await requireTimetableUser(event)).id, getRouterParam(event, 'id')) } catch (error) { return handleTimetableError(event, error, 'Loading import') } })

