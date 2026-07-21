export function detectTimetableFormat(text, words = []) {
  const value = String(text || '').toUpperCase()
  const registeredSignals = ['COURSE TYPE', 'INDEX NUMBER', 'CLASS TYPE', 'REGISTERED', 'WAITLIST', 'COURSE', 'VENUE'].filter(signal => value.includes(signal)).length
  const daySignals = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].filter(signal => new RegExp(`\\b${signal}`).test(value)).length
  const gridSignals = Number(value.includes('TIME/DAY')) * 2 + daySignals + Number(/\b\d{4}\s*[-–]\s*\d{4}\b/.test(value))
  if (registeredSignals >= 2 && registeredSignals >= gridSignals) return { format: 'REGISTERED_COURSES', confidence: Math.min(1, registeredSignals / 6) }
  if (gridSignals >= 4 && words.length) return { format: 'WEEKLY_GRID', confidence: Math.min(0.85, gridSignals / 8) }
  return { format: 'UNKNOWN', confidence: 0.25 }
}

