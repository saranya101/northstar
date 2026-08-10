const activeTask = task => !['COMPLETED', 'CANCELLED'].includes(task.status)
const dayKey = (value, timeZone = 'Asia/Singapore') => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function todayActionCandidates({ tasks = [], coursework = [], assessments = [], plannedBlocks = [] }, now = new Date(), timeZone = 'Asia/Singapore') {
  const today = dayKey(now, timeZone)
  const candidates = []
  for (const task of tasks.filter(activeTask)) {
    const due = task.dueAt ? new Date(task.dueAt) : null
    const dueDay = due ? dayKey(due, timeZone) : null
    const rank = dueDay && dueDay < today ? 1 : dueDay === today ? 2 : task.status === 'IN_PROGRESS' ? 5 : 8
    candidates.push({ kind: 'TASK', id: task.id, title: task.title, moduleCode: task.moduleCode || null, timingNote: task.timingNote || null, estimatedMinutes: task.estimatedMinutes || null, dueAt: task.dueAt || null, rank, to: `/app/tasks?view=${rank === 1 ? 'OVERDUE' : rank === 2 ? 'TODAY' : 'ALL'}` })
  }
  for (const item of coursework) {
    const due = item.dueAt ? new Date(item.dueAt) : null
    const rank = due && dayKey(due, timeZone) < today && !['SUBMITTED', 'VERIFIED', 'EXCUSED'].includes(item.status) ? 1 : item.completeBeforeClass && !['SUBMITTED', 'VERIFIED', 'EXCUSED'].includes(item.status) ? 3 : item.status === 'SUBMITTED' && !item.verified ? 4 : null
    if (rank) candidates.push({ kind: 'COURSEWORK', id: item.id, title: item.title, moduleCode: item.moduleCode, timingNote: item.timingNote, estimatedMinutes: item.estimatedMinutes || null, dueAt: item.dueAt || null, rank, to: `/app/recurring-coursework/${item.requirementId}` })
  }
  for (const assessment of assessments) {
    const when = assessment.date ? new Date(assessment.date) : null
    if (when && when >= now) candidates.push({ kind: 'ASSESSMENT', id: assessment.id, title: `Prepare for ${assessment.name}`, moduleCode: assessment.moduleCode, timingNote: assessment.weight === null ? null : `${assessment.weight}%`, estimatedMinutes: assessment.estimatedMinutes || null, dueAt: assessment.date, rank: 6, to: `/app/assessments/${assessment.id}` })
  }
  for (const block of plannedBlocks.filter(item => item.date === today)) candidates.push({ kind: 'PLANNED_BLOCK', id: block.id, title: block.title, moduleCode: block.moduleCode, timingNote: block.goal || null, estimatedMinutes: block.endMinutes - block.startMinutes, dueAt: null, rank: 7, to: '/app/planner' })
  return candidates.sort((left, right) => left.rank - right.rank || String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999')) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
}

export function recommendedTodayAction(input, now = new Date()) { return todayActionCandidates(input, now)[0] || null }

export function summarizeModules(enrolments = [], now = new Date()) {
  return enrolments.map(item => ({
    enrolmentId: item.enrolmentId, code: item.code, title: item.title, academicUnits: item.academicUnits,
    nextClass: (item.sessions || []).find(session => session.dayOfWeek === now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()) || (item.sessions || [])[0] || null,
    nextAssessment: (item.assessments || []).filter(value => value.date && new Date(value.date) >= now).sort((a, b) => a.date.localeCompare(b.date))[0] || null,
    openTaskCount: (item.tasks || []).filter(activeTask).length,
    courseworkAttentionCount: (item.coursework || []).filter(value => ['NOT_STARTED', 'IN_PROGRESS', 'MISSED', 'SUBMITTED'].includes(value.status)).length,
    knownGradeWeight: (item.assessments || []).filter(value => value.status === 'GRADED').reduce((sum, value) => sum + (Number(value.weight) || 0), 0)
  }))
}
