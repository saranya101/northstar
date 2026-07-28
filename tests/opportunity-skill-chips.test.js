import { describe, expect, it } from 'vitest'
import {
  addSkillChip,
  MAX_SKILL_GOALS,
  removeSkillChip,
  uniqueSkillChips,
} from '../app/utils/skill-chips.js'

describe('Opportunity Radar skill chips', () => {
  it('loads existing values as trimmed unique chips', () => {
    expect(uniqueSkillChips([
      ' JavaScript ',
      'javascript',
      'Public   speaking',
    ])).toEqual(['JavaScript', 'Public speaking'])
  })

  it('adds custom skills and rejects empty or duplicate values', () => {
    expect(addSkillChip(['Research'], ' Public speaking '))
      .toEqual(['Research', 'Public speaking'])
    expect(addSkillChip(['Research'], 'research'))
      .toEqual(['Research'])
    expect(addSkillChip(['Research'], '   '))
      .toEqual(['Research'])
  })

  it('removes an individual chip case-insensitively', () => {
    expect(removeSkillChip(
      ['JavaScript', 'Research'],
      'javascript',
    )).toEqual(['Research'])
  })

  it('enforces the existing maximum skill count', () => {
    const skills = Array.from(
      { length: MAX_SKILL_GOALS },
      (_, index) => `Skill ${index}`,
    )
    expect(addSkillChip(skills, 'One more'))
      .toHaveLength(MAX_SKILL_GOALS)
  })
})
