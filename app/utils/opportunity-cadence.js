export const OPPORTUNITY_CADENCE_MS = Object.freeze({
  MANUAL: null,
  HOURLY: 60 * 60 * 1000,
  EVERY_6_HOURS: 6 * 60 * 60 * 1000,
  EVERY_12_HOURS: 12 * 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
})

export function opportunityCadenceMs(cadence) {
  return OPPORTUNITY_CADENCE_MS[cadence] ?? null
}
