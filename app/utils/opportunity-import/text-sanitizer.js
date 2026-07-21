const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const IDENTITY_HEADER = /^(?:student\s*)?(?:name|email|e-mail|matric(?:ulation)?\s*(?:number|no\.?|id)|student\s*(?:number|no\.?|id)|prepared\s+for|downloaded\s+by|generated\s+for|applicant)\s*[:–-]/i
const OPPORTUNITY_WORD = /\b(?:intern|hackathon|competition|scholarship|grant|research|programme|program|workshop|job|role|opportunity|apply|application|deadline|event)\b/i

function looksLikePersonName(value) {
  const words = value.trim().split(/\s+/)
  return words.length >= 2 && words.length <= 4 && value.length <= 80 && !OPPORTUNITY_WORD.test(value)
    && words.every(word => /^[A-Z][A-Za-z'’-]*$/.test(word))
}

export function sanitiseOpportunityText(input) {
  const lines = String(input || '').replace(/\0|\f|\u200B|\u200C|\u200D/g, '').replace(/\r/g, '').split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
  const remove = new Set()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || IDENTITY_HEADER.test(line)) remove.add(index)
    if (EMAIL.test(line)) {
      remove.add(index)
      const previous = lines[index - 1]
      if (previous && looksLikePersonName(previous)) remove.add(index - 1)
    }
    EMAIL.lastIndex = 0
  }
  return lines.filter((_, index) => !remove.has(index)).join('\n').replace(EMAIL, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20_000)
}

export function sanitiseOpportunityCandidate(result) {
  const candidate = Object.fromEntries(Object.entries(result.candidate).map(([key, detail]) => {
    if (typeof detail.value !== 'string' || !EMAIL.test(detail.value)) { EMAIL.lastIndex = 0; return [key, detail] }
    EMAIL.lastIndex = 0
    return [key, { ...detail, value: null, confidence: 0, warnings: [...detail.warnings, 'An email address was removed from this field.'].slice(0, 5) }]
  }))
  return { ...result, candidate }
}
