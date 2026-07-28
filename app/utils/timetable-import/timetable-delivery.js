const ONLINE_PATTERN = /\b(?:ONLINE|ZOOM|MS\s*TEAMS|TEAMS)\b/i
const TBC_PATTERN = /\bTBC\b/i
const PHYSICAL_PATTERNS = [
  /\b(?:LT\d+[A-Z]?|LKC-LT|NIE-LT\d+)\b/i,
  /\b(?:TR|SR)\+?\d+[A-Z]?\b/i,
  /\b(?:ESR|CR)\d+[A-Z]?\b/i,
  /\b[A-Z]\d+(?:-[A-Z0-9]+)+\b/i,
  /\b(?:SWLAB\d+|SPL|EXAMHALL\s*[A-Z0-9]+|COLLAB\s*\d+|TCT-LT|LH[NS]-TR\+?\d+)\b/i,
  /\b(?:AUDITORIUM|SEMINAR ROOM|LECTURE THEATRE|TUTORIAL ROOM|LAB(?:ORATORY)?)\b/i
]

export function hasPhysicalVenue(value) {
  return PHYSICAL_PATTERNS.some(pattern => pattern.test(String(value || '')))
}

export function detectDeliveryMode(value) {
  const text = String(value || '')
  const online = ONLINE_PATTERN.test(text)
  const physical = hasPhysicalVenue(text)
  if (online && physical) return 'HYBRID'
  if (online) return 'ONLINE'
  if (TBC_PATTERN.test(text)) return 'TBC'
  if (physical) return 'IN_PERSON'
  return 'UNKNOWN'
}

export function deliveryModeLabel(mode) {
  return { IN_PERSON: 'In person', ONLINE: 'Online', HYBRID: 'Hybrid', TBC: 'To be confirmed', UNKNOWN: 'Unknown delivery' }[mode] || 'Unknown delivery'
}

export function deliveryModeIcon(mode) {
  return { IN_PERSON: 'i-lucide-map-pin', ONLINE: 'i-lucide-video', HYBRID: 'i-lucide-blend', TBC: 'i-lucide-circle-help', UNKNOWN: 'i-lucide-circle-alert' }[mode] || 'i-lucide-circle-alert'
}
