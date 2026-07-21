import { ntuEnrichmentQuerySchema } from '~~/shared/schemas/timetable'
import { ntuCourseEnrichment } from '../../services/ntu-course-enrichment'
import { handleTimetableError, requireTimetableUser } from '../../utils/timetable-request'
import { readModuleQuery } from '../../utils/module-request'

export default defineEventHandler(async (event) => {
  try {
    await requireTimetableUser(event)
    return await ntuCourseEnrichment.enrich(await readModuleQuery(event, ntuEnrichmentQuerySchema))
  } catch (error) { return handleTimetableError(event, error, 'Enriching an NTU course') }
})
