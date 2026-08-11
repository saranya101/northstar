import { PREPARATION_STATUS_FIELDS } from '../schemas/preparation.js'

export const PREPARATION_READINESS = Object.freeze({
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  NOT_STARTED: 'NOT_STARTED'
})

export const DEFAULT_PREPARATION = Object.freeze({
  materialStatus: 'NOT_STARTED',
  notesStatus: 'NOT_STARTED',
  requiredWorkStatus: 'NOT_STARTED',
  practiceStatus: 'NOT_STARTED',
  questions: null
})

const GAP_NAMES = Object.freeze({
  materialStatus: 'MATERIAL',
  notesStatus: 'NOTES',
  requiredWorkStatus: 'REQUIRED_WORK',
  practiceStatus: 'PRACTICE'
})

export function normalizePreparation(preparation = null) {
  return {
    materialStatus: preparation?.materialStatus || DEFAULT_PREPARATION.materialStatus,
    notesStatus: preparation?.notesStatus || DEFAULT_PREPARATION.notesStatus,
    requiredWorkStatus: preparation?.requiredWorkStatus || DEFAULT_PREPARATION.requiredWorkStatus,
    practiceStatus: preparation?.practiceStatus || DEFAULT_PREPARATION.practiceStatus,
    questions: preparation?.questions ?? null
  }
}

export function derivePreparationReadiness(preparation) {
  const normalized = normalizePreparation(preparation)
  const applicable = PREPARATION_STATUS_FIELDS.map(field => normalized[field]).filter(status => status !== 'NOT_REQUIRED')
  if (applicable.every(status => status === 'DONE')) return PREPARATION_READINESS.READY
  if (applicable.some(status => status === 'DONE' || status === 'IN_PROGRESS')) return PREPARATION_READINESS.IN_PROGRESS
  return PREPARATION_READINESS.NOT_STARTED
}

export function getPreparationGaps({ preparation, moduleCode, teachingWeek, classStart }) {
  const normalized = normalizePreparation(preparation)
  return {
    moduleCode,
    teachingWeek,
    classStart,
    missing: PREPARATION_STATUS_FIELDS.filter(field => !['DONE', 'NOT_REQUIRED'].includes(normalized[field])).map(field => GAP_NAMES[field]),
    readiness: derivePreparationReadiness(normalized)
  }
}
