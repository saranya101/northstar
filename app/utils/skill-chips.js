export const MAX_SKILL_GOALS = 30
export const MAX_SKILL_LENGTH = 80

export function normalizeSkillChip(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function uniqueSkillChips(values = []) {
  const seen = new Set()

  return values
    .map(normalizeSkillChip)
    .filter(Boolean)
    .filter(value => {
      const key = value.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_SKILL_GOALS)
}

export function addSkillChip(values, value) {
  const skill = normalizeSkillChip(value)
  if (!skill || skill.length > MAX_SKILL_LENGTH) {
    return uniqueSkillChips(values)
  }

  return uniqueSkillChips([...(values || []), skill])
}

export function removeSkillChip(values, value) {
  const target = normalizeSkillChip(value).toLocaleLowerCase()

  return uniqueSkillChips(values)
    .filter(skill => skill.toLocaleLowerCase() !== target)
}
