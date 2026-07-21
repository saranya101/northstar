import { getRouterParam } from 'h3'
import { cancelTimetableImport } from '../../../services/timetable'
import { handleTimetableError, requireTimetableUser } from '../../../utils/timetable-request'
export default defineEventHandler(async (event) => { try { return await cancelTimetableImport((await requireTimetableUser(event)).id, getRouterParam(event, 'id')) } catch (error) { return handleTimetableError(event, error, 'Cancelling import') } })

