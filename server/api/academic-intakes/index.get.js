import { listAcademicIntakes } from '../../services/academic-intakes'
import { requireAcademicIntakeUser } from '../../utils/academic-intake-request'
export default defineEventHandler(async event => listAcademicIntakes((await requireAcademicIntakeUser(event)).id))
