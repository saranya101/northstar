import { describe, expect, it } from 'vitest'
import { OPPORTUNITY_CATEGORIES, opportunityFiltersSchema } from '../shared/schemas/opportunities'
import { getOpportunitySection, getOpportunitySections, getSectionForCategory } from '../shared/opportunities/taxonomy'
import { normaliseOpportunityTag, normaliseOpportunityTags } from '../shared/opportunities/tags'

describe('opportunity discovery taxonomy', () => {
  it('contains eight unique discovery sections', () => {
    const sections = getOpportunitySections()
    expect(sections).toHaveLength(8)
    expect(new Set(sections.map(section => section.slug)).size).toBe(8)
  })

  it('maps every taxonomy category to its section', () => {
    for (const section of getOpportunitySections()) {
      for (const category of section.categories) {
        expect(OPPORTUNITY_CATEGORIES).toContain(category)
        expect(getSectionForCategory(category)).toBe(section.slug)
      }
    }
  })

  it('maps hackathons to the intended category group', () => {
    expect(getOpportunitySection('hackathons')?.categories).toEqual(['HACKATHON', 'COMPETITION', 'PROJECT'])
  })
})

describe('opportunity discovery filters', () => {
  it('parses, trims and deduplicates multiple categories', () => {
    const result = opportunityFiltersSchema.parse({
      categories: 'HACKATHON, COMPETITION,HACKATHON',
      tag: 'AI',
      mode: 'ONLINE'
    })
    expect(result.categories).toEqual(['HACKATHON', 'COMPETITION'])
    expect(result.tag).toBe('AI')
    expect(result.mode).toBe('ONLINE')
  })

  it('rejects invalid categories', () => {
    expect(() => opportunityFiltersSchema.parse({ categories: 'HACKATHON,NOT_REAL' })).toThrow()
  })
})

describe('opportunity tag normalisation', () => {
  it('normalises controlled aliases', () => {
    expect(normaliseOpportunityTag('machine learning')).toBe('AI')
    expect(normaliseOpportunityTag('fin tech')).toBe('Fintech')
    expect(normaliseOpportunityTag('social good')).toBe('Social Impact')
  })

  it('deduplicates canonical tags', () => {
    expect(normaliseOpportunityTags(['AI', 'machine learning', 'cyber security'])).toEqual(['AI', 'Cybersecurity'])
  })
})
