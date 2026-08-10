import { getAcademicIntake } from '../../services/academic-intakes'
import { requireAcademicIntakeUser } from '../../utils/academic-intake-request'
export default defineEventHandler(async event => getAcademicIntake((await requireAcademicIntakeUser(event)).id, getRouterParam(event, 'id')))
