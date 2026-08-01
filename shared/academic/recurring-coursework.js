const completedStatuses = new Set(['SUBMITTED', 'VERIFIED'])

export function planTeachingWeeks({ frequency, totalExpected, firstTeachingWeek, lastTeachingWeek, recessWeeks = [], includeRecessWeeks = false }) {
  const first = firstTeachingWeek ?? null
  const last = lastTeachingWeek ?? null
  if (first === null || last === null) return Array.from({ length: totalExpected }, () => null)
  const recess = new Set(includeRecessWeeks ? [] : recessWeeks)
  const available = []
  for (let week = first; week <= last; week += frequency === 'FORTNIGHTLY' ? 2 : 1) {
    if (!recess.has(week)) available.push(week)
  }
  return Array.from({ length: totalExpected }, (_, index) => available[index] ?? null)
}

export function buildMissingOccurrences(definition, existing = []) {
  const existingSequences = new Set(existing.map(item => item.sequenceNumber))
  const weeks = planTeachingWeeks(definition)
  return weeks.flatMap((teachingWeek, index) => {
    const sequenceNumber = index + 1
    return existingSequences.has(sequenceNumber) ? [] : [{ sequenceNumber, teachingWeek }]
  })
}

export function recurringCourseworkProgress(occurrences = []) {
  const completedCount = occurrences.filter(item => completedStatuses.has(item.status)).length
  const submittedCount = occurrences.filter(item => item.status === 'SUBMITTED' || item.status === 'VERIFIED').length
  const verifiedCount = occurrences.filter(item => item.status === 'VERIFIED').length
  const missedCount = occurrences.filter(item => item.status === 'MISSED').length
  const excusedCount = occurrences.filter(item => item.status === 'EXCUSED').length
  const unverifiedSubmissionCount = occurrences.filter(item => item.status === 'SUBMITTED').length
  const nextIncomplete = occurrences.filter(item => !completedStatuses.has(item.status) && !['MISSED', 'EXCUSED'].includes(item.status)).toSorted((left, right) => left.sequenceNumber - right.sequenceNumber)[0] || null
  const nextKnownDeadline = occurrences
    .filter(item => !completedStatuses.has(item.status) && !['MISSED', 'EXCUSED'].includes(item.status) && item.officialDueAt)
    .toSorted((left, right) => new Date(left.officialDueAt) - new Date(right.officialDueAt) || left.sequenceNumber - right.sequenceNumber)[0] || null
  const captured = occurrences.filter(item => item.score !== null && item.score !== undefined && item.maximumScore !== null && item.maximumScore !== undefined)
  const capturedScore = captured.reduce((sum, item) => sum + Number(item.score), 0)
  const capturedMaximum = captured.reduce((sum, item) => sum + Number(item.maximumScore), 0)
  return {
    totalCount: occurrences.length,
    completedCount,
    remainingCount: occurrences.length - completedCount - missedCount - excusedCount,
    submittedCount,
    verifiedCount,
    missedCount,
    excusedCount,
    completionPercentage: occurrences.length ? Math.round(completedCount / occurrences.length * 100) : 0,
    nextIncomplete,
    nextKnownDeadline,
    unverifiedSubmissionCount,
    capturedMarks: captured.length ? { score: capturedScore, maximumScore: capturedMaximum, percentage: capturedMaximum ? capturedScore / capturedMaximum * 100 : null } : null
  }
}

export function hasUnverifiedSubmission(occurrence) {
  return occurrence.status === 'SUBMITTED'
}
