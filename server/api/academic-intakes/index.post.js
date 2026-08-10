import { createAcademicIntakeSchema } from '#shared/schemas/academic-intake'
import { createAcademicIntake } from '../../services/academic-intakes'
import { readAcademicIntakeBody, requireAcademicIntakeUser } from '../../utils/academic-intake-request'
export default defineEventHandler(async event => createAcademicIntake((await requireAcademicIntakeUser(event)).id, await readAcademicIntakeBody(event, createAcademicIntakeSchema)))
