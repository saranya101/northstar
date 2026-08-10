import { proposalDecisionSchema } from '#shared/schemas/academic-intake'
import { approveAcademicProposal } from '../../../../../services/academic-intakes'
import { readAcademicIntakeBody, requireAcademicIntakeUser } from '../../../../../utils/academic-intake-request'
export default defineEventHandler(async event => approveAcademicProposal((await requireAcademicIntakeUser(event)).id, getRouterParam(event, 'id'), getRouterParam(event, 'proposalId'), await readAcademicIntakeBody(event, proposalDecisionSchema)))
