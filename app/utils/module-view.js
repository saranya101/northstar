export function hasActiveModules(moduleState) {
  return Boolean(moduleState?.modules?.length)
}

export function activeModuleCount(moduleState) {
  return Number.isInteger(moduleState?.activeCount) ? moduleState.activeCount : 0
}
