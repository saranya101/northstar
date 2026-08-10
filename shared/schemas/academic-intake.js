import { z } from 'zod'

export const ACADEMIC_INTAKE_CATEGORIES = ['ASSESSMENT_UPDATE', 'NEW_ASSESSMENT', 'COURSEWORK', 'DEADLINE', 'CLASS_UPDATE', 'TASK', 'STUDY_PLAN', 'GRADE_RESULT', 'LECTURER_INSTRUCTION', 'EXAM_INFORMATION', 'ANNOUNCEMENT', 'GENERAL_NOTE']
export const ACADEMIC_PROPOSAL_ACTIONS = ['CREATE_TASK', 'UPDATE_TASK', 'CREATE_ASSESSMENT', 'UPDATE_ASSESSMENT', 'CREATE_COURSEWORK', 'UPDATE_COURSEWORK', 'RECORD_GRADE', 'CREATE_STUDY_PLAN', 'ADD_NOTE']
export const ACADEMIC_PROPOSAL_TARGETS = ['TASK', 'ASSESSMENT', 'RECURRING_COURSEWORK', 'STUDY_PLAN', 'MODULE_NOTE']
const optionalId = z.preprocess(value => value === '' || value === null ? undefined : value, z.string().trim().min(1).max(100).optional())

export const createAcademicIntakeSchema = z.object({
  rawText: z.string().trim().min(10).max(30_000),
  moduleEnrolmentId: optionalId
}).strict()

export const academicProposalResultSchema = z.object({
  category: z.enum(ACADEMIC_INTAKE_CATEGORIES),
  moduleEnrolmentId: optionalId,
  clarificationReason: z.string().trim().min(1).max(500).nullable().default(null),
  proposals: z.array(z.object({
    actionType: z.enum(ACADEMIC_PROPOSAL_ACTIONS),
    targetType: z.enum(ACADEMIC_PROPOSAL_TARGETS),
    targetId: optionalId,
    payload: z.record(z.string(), z.json())
  }).strict()).max(10)
}).strict()

export const proposalDecisionSchema = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict()
