const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value))
const round = value => Math.round((value + Number.EPSILON) * 100) / 100

function scoredPercentage(assessment) {
  if (finite(assessment.percentageScore)) return Number(assessment.percentageScore)
  if (!finite(assessment.score) || !finite(assessment.maximumScore) || Number(assessment.maximumScore) <= 0) return null
  return Number(assessment.score) / Number(assessment.maximumScore) * 100
}

export function calculateGradeIntelligence(assessments, targetPercentage = null, scenarios = {}) {
  const included = assessments.filter(item => item.status !== 'CANCELLED')
  const warnings = []
  let confirmedWeight = 0
  let gradedWeight = 0
  let currentWeightedScore = 0
  let projectedContribution = 0

  for (const assessment of included) {
    const weight = finite(assessment.weight) ? Number(assessment.weight) : null
    if (weight === null) {
      warnings.push(`${assessment.name || 'An assessment'} has no weight.`)
      continue
    }
    if (weight < 0 || weight > 100) {
      warnings.push(`${assessment.name || 'An assessment'} has an invalid weight.`)
      continue
    }
    confirmedWeight += weight
    const confirmed = scoredPercentage(assessment)
    const hypothetical = finite(scenarios[assessment.id]) ? Number(scenarios[assessment.id]) : null
    if (confirmed !== null) {
      gradedWeight += weight
      currentWeightedScore += confirmed * weight / 100
      projectedContribution += confirmed * weight / 100
    } else if (hypothetical !== null && hypothetical >= 0 && hypothetical <= 100) {
      projectedContribution += hypothetical * weight / 100
    }
  }

  const remainingWeight = Math.max(0, 100 - gradedWeight)
  const knownUngradedWeight = Math.max(0, confirmedWeight - gradedWeight)
  const target = finite(targetPercentage) ? Number(targetPercentage) : null
  const requiredAverage = target === null || remainingWeight === 0
    ? null
    : (target - currentWeightedScore) / remainingWeight * 100
  const currentAverage = gradedWeight > 0 ? currentWeightedScore / gradedWeight * 100 : null
  const projectedFinal = projectedContribution + Math.max(0, 100 - confirmedWeight) * (currentAverage ?? 0) / 100
  const bestCase = currentWeightedScore + remainingWeight

  if (confirmedWeight < 100) warnings.push(`Assessment weights total ${round(confirmedWeight)}%, so the structure is incomplete.`)
  if (confirmedWeight > 100) warnings.push(`Assessment weights total ${round(confirmedWeight)}%, which exceeds 100%.`)
  if (target !== null && (target < 0 || target > 100)) warnings.push('The target percentage must be between 0 and 100.')

  let targetState = 'INSUFFICIENT_DATA'
  if (target !== null && target >= 0 && target <= 100) {
    if (currentWeightedScore >= target) targetState = 'SECURED'
    else if (bestCase < target) targetState = 'IMPOSSIBLE'
    else if (requiredAverage > 85) targetState = 'STRONG_RESULTS_REQUIRED'
    else targetState = 'ACHIEVABLE'
  }

  return {
    confirmedWeight: round(confirmedWeight),
    gradedWeight: round(gradedWeight),
    remainingWeight: round(remainingWeight),
    knownUngradedWeight: round(knownUngradedWeight),
    currentWeightedScore: round(currentWeightedScore),
    currentAverage: currentAverage === null ? null : round(currentAverage),
    projectedFinal: gradedWeight === 0 && Object.keys(scenarios).length === 0 ? null : round(projectedFinal),
    bestCase: round(bestCase),
    requiredAverage: requiredAverage === null ? null : round(requiredAverage),
    targetPercentage: target,
    targetPossible: target === null ? null : bestCase >= target,
    targetState,
    warnings: [...new Set(warnings)]
  }
}

export function requiredScoreForAssessment({ assessment, assessments, targetPercentage }) {
  if (!finite(assessment?.weight) || Number(assessment.weight) <= 0) return null
  const other = assessments.filter(item => item.id !== assessment.id)
  const intelligence = calculateGradeIntelligence(other, targetPercentage)
  const needed = (Number(targetPercentage) - intelligence.currentWeightedScore) / Number(assessment.weight) * 100
  return Number.isFinite(needed) ? round(needed) : null
}
