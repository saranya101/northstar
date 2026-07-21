export const OPPORTUNITY_TAG_ALIASES = {
  'artificial intelligence': 'AI',
  'machine learning': 'AI',
  'machine learning/ai': 'AI',
  'artificial intelligence/machine learning': 'AI',
  ai: 'AI',
  'financial technology': 'Fintech',
  'fin tech': 'Fintech',
  fintech: 'Fintech',
  'social good': 'Social Impact',
  'social impact': 'Social Impact',
  climate: 'Sustainability',
  sustainability: 'Sustainability',
  'web development': 'Web Development',
  'open source': 'Open Source',
  'business case': 'Business Case',
  'cyber security': 'Cybersecurity',
  cybersecurity: 'Cybersecurity'
}

function titleCase(value) {
  return value
    .toLocaleLowerCase()
    .replace(/(^|[\s/&+()-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`)
}

export function normaliseOpportunityTag(value) {
  if (typeof value !== 'string') return null
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!clean) return null

  const alias = OPPORTUNITY_TAG_ALIASES[clean.toLocaleLowerCase()]
  if (alias) return alias
  if (/^[A-Z0-9&.+-]{2,8}$/.test(clean)) return clean

  return titleCase(clean)
}

export function normaliseOpportunityTags(values, maximum = 12) {
  if (!Array.isArray(values)) return []
  const result = []
  const seen = new Set()

  for (const value of values) {
    const tag = normaliseOpportunityTag(value)
    if (!tag) continue
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length >= maximum) break
  }

  return result
}
