function issue(id, label, context = 'Import structure') {
  return { id: `structure-${id}`, moduleCandidateId: null, sessionCandidateId: null, field: 'structure', label, context, targetId: 'review-structure' }
}

export function timetableStructureIssues(modules = [], draft = {}) {
  const issues = []
  const summary = draft?.sourceSummary
  const structure = draft?.structure
  const moduleCount = modules.length
  const academicUnits = modules.reduce((sum, module) => sum + (Number(module.academicUnits) || 0), 0)
  if (summary?.moduleCount !== null && summary?.moduleCount !== undefined && summary.moduleCount !== moduleCount) issues.push(issue('module-count', `Source lists ${summary.moduleCount} courses, but ${moduleCount} were reconstructed`))
  if (summary?.totalAcademicUnits !== null && summary?.totalAcademicUnits !== undefined && Math.abs(summary.totalAcademicUnits - academicUnits) > 0.001) issues.push(issue('academic-units', `Source lists ${summary.totalAcademicUnits} AU, but reconstructed courses total ${academicUnits} AU`))
  const sessions = modules.flatMap(module => module.sessions || [])
  if (structure?.gridVisible && sessions.length === 0) issues.push(issue('zero-sessions', 'A visible weekly grid produced no sessions'))
  const moduleCodes = new Set(modules.map(module => module.code))
  for (const code of structure?.gridModuleCodes || []) if (!moduleCodes.has(code)) issues.push(issue(`missing-grid-${code}`, `${code} appears in the grid but has no registered-course candidate`, code))
  let sessionStructureMismatch = false
  for (const [code, detected] of Object.entries(structure?.detectedSessionBlocks || {})) {
    const reconstructed = modules.find(module => module.code === code)?.sessions?.length || 0
    if (detected > reconstructed) {
      sessionStructureMismatch = true
      issues.push(issue(`missing-session-${code}`, `${code} has ${detected} visible class block${detected === 1 ? '' : 's'}, but only ${reconstructed} session${reconstructed === 1 ? ' was' : 's were'} reconstructed`, code))
    }
  }
  if (!sessionStructureMismatch && structure?.droppedSessionBlockCount > 0) issues.push(issue('dropped-session-blocks', `${structure.droppedSessionBlockCount} recognised class block${structure.droppedSessionBlockCount === 1 ? ' was' : 's were'} dropped during validation`))
  const examRowsReconstructed = structure?.examRowsReconstructed ?? modules.filter(module => module.examCandidate !== null && module.examCandidate !== undefined).length
  if (structure?.examRowsDetected > examRowsReconstructed) issues.push(issue('exam-rows', `${structure.examRowsDetected} exam rows were visible, but only ${examRowsReconstructed} were reconstructed`))
  for (const module of modules) if (module.titleNeedsReview) issues.push({ ...issue(`title-${module.candidateId}`, 'Review the visibly truncated title', module.code), moduleCandidateId: module.candidateId, field: 'title', targetId: `review-${module.candidateId}-title` })
  const identities = new Map()
  for (const module of modules) {
    const key = `${module.code}|${module.indexNumber || ''}`
    if (identities.has(key)) issues.push(issue(`duplicate-${module.candidateId}`, `Duplicate module/index record: ${module.code} ${module.indexNumber || ''}`.trim(), module.code))
    identities.set(key, module.candidateId)
  }
  return issues
}
