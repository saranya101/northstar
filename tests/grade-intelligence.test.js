import { describe, expect, it } from 'vitest'
import { calculateGradeIntelligence, requiredScoreForAssessment } from '../shared/academic/grade-intelligence'

const item = (id, weight, percentageScore, status = percentageScore === null ? 'NOT_STARTED' : 'GRADED') => ({ id, name: id, weight, percentageScore, status })

describe('grade intelligence', () => {
  it('calculates current score, weights, best case and required average', () => {
    const result = calculateGradeIntelligence([item('coursework', 55, 74.91), item('final', 45, null)], 75)
    expect(result.currentWeightedScore).toBe(41.2)
    expect(result.gradedWeight).toBe(55)
    expect(result.remainingWeight).toBe(45)
    expect(result.bestCase).toBe(86.2)
    expect(result.requiredAverage).toBe(75.11)
    expect(result.targetState).toBe('ACHIEVABLE')
  })

  it('derives percentages from decimal scores deterministically', () => {
    const assessment = { id: 'a', name: 'Quiz', weight: 25, score: 17.5, maximumScore: 20, percentageScore: null, status: 'GRADED' }
    expect(calculateGradeIntelligence([assessment]).currentWeightedScore).toBe(21.88)
    expect(calculateGradeIntelligence([assessment])).toEqual(calculateGradeIntelligence([assessment]))
  })

  it('handles no graded work and incomplete weights', () => {
    const result = calculateGradeIntelligence([item('final', 40, null)], 70)
    expect(result.currentAverage).toBeNull()
    expect(result.projectedFinal).toBeNull()
    expect(result.warnings.join(' ')).toMatch(/incomplete/)
  })

  it('warns when weights exceed 100%', () => {
    expect(calculateGradeIntelligence([item('a', 60, 80), item('b', 50, null)]).warnings.join(' ')).toMatch(/exceeds 100/)
  })

  it('excludes cancelled assessments', () => {
    const result = calculateGradeIntelligence([item('graded', 50, 80), item('cancelled', 50, 100, 'CANCELLED')])
    expect(result.currentWeightedScore).toBe(40)
    expect(result.gradedWeight).toBe(50)
  })

  it('detects impossible and already-secured targets', () => {
    expect(calculateGradeIntelligence([item('graded', 80, 50), item('left', 20, null)], 70).targetState).toBe('IMPOSSIBLE')
    expect(calculateGradeIntelligence([item('graded', 80, 100), item('left', 20, null)], 75).targetState).toBe('SECURED')
  })

  it('applies hypothetical scenarios without mutating inputs', () => {
    const assessments = [item('graded', 50, 80), item('final', 50, null)]
    const result = calculateGradeIntelligence(assessments, 75, { final: 70 })
    expect(result.projectedFinal).toBe(75)
    expect(assessments[1].percentageScore).toBeNull()
  })

  it('calculates a required selected-assessment score when possible', () => {
    const final = item('final', 40, null)
    expect(requiredScoreForAssessment({ assessment: final, assessments: [item('coursework', 60, 75), final], targetPercentage: 70 })).toBe(62.5)
  })
})
