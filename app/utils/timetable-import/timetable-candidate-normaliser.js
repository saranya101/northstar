export function candidateId(prefix = 'candidate') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function mapRegistrationStatus(value) {
  const text = String(value || '').toUpperCase()
  if (text.includes('WAITLIST')) return 'WAITLISTED'
  if (text.includes('EXEMPT')) return 'EXEMPTED'
  if (text.includes('REGISTERED')) return 'REGISTERED'
  return 'UNKNOWN'
}

export function mapClassType(value) {
  const text = String(value || '').toUpperCase()
  if (/^LEC|LECTURE/.test(text)) return 'LECTURE'
  if (/^TUT|TUTORIAL/.test(text)) return 'TUTORIAL'
  if (/^SEM|SEMINAR/.test(text)) return 'SEMINAR'
  if (/^LAB|LABORATORY/.test(text)) return 'LABORATORY'
  if (text.includes('WORKSHOP')) return 'WORKSHOP'
  if (/^(?:PRJ|PROJECT)/.test(text)) return 'PROJECT'
  if (text.includes('FIELD')) return 'FIELDWORK'
  return 'OTHER'
}
