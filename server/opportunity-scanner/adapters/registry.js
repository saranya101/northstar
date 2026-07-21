import { devpostOpportunityAdapter } from './devpost'
import { mockOpportunityAdapter } from './mock'

const adapters = new Map([[mockOpportunityAdapter.key, mockOpportunityAdapter], [devpostOpportunityAdapter.key, devpostOpportunityAdapter]])

export function registerOpportunityAdapter(adapter) {
  if (adapters.has(adapter.key)) throw new Error(`An opportunity adapter is already registered for ${adapter.key}.`)
  adapters.set(adapter.key, adapter)
  return adapter
}

export function getOpportunityAdapter(key) {
  return adapters.get(key) || null
}

export function listOpportunityAdapterKeys() {
  return [...adapters.keys()].sort()
}

export function replaceOpportunityAdapterForTests(adapter) {
  adapters.set(adapter.key, adapter)
  return () => adapters.set(adapter.key, mockOpportunityAdapter)
}
