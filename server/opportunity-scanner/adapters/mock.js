import { defineOpportunityAdapter } from './contract'

export function createMockOpportunityAdapter(candidates = []) {
  return defineOpportunityAdapter({
    key: 'mock',
    name: 'Mock opportunities',
    slug: 'mock',
    baseUrl: 'https://mock.example/',
    async fetchCandidates() { return structuredClone(candidates) }
  })
}

export const mockOpportunityAdapter = createMockOpportunityAdapter()

