import { calculateGradeIntelligence } from '#shared/academic/grade-intelligence'

export function useGradeIntelligence(assessments, targetPercentage) {
  const scenarios = ref({})
  const result = computed(() => calculateGradeIntelligence(unref(assessments) || [], unref(targetPercentage), scenarios.value))
  function setScenario(id, value) {
    const number = value === '' || value === null ? null : Number(value)
    if (number === null || !Number.isFinite(number)) delete scenarios.value[id]
    else scenarios.value[id] = Math.min(100, Math.max(0, number))
    scenarios.value = { ...scenarios.value }
  }
  function resetScenarios() { scenarios.value = {} }
  return { scenarios, result, setScenario, resetScenarios }
}
