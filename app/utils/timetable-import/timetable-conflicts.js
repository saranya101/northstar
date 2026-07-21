function recurrenceWeeks(session) {
  if (session.recurrence === 'ODD_WEEKS') return Array.from({ length: 26 }, (_, index) => index * 2 + 1)
  if (session.recurrence === 'EVEN_WEEKS') return Array.from({ length: 26 }, (_, index) => index * 2 + 2)
  if (session.recurrence === 'CUSTOM') return session.weekNumbers || []
  return Array.from({ length: 52 }, (_, index) => index + 1)
}

export function recurrencesOverlap(left, right) {
  const rightWeeks = new Set(recurrenceWeeks(right))
  return recurrenceWeeks(left).some(week => rightWeeks.has(week))
}

export function sessionsConflict(left, right) {
  return left !== right && left.dayOfWeek === right.dayOfWeek && Number.isInteger(left.startMinutes) && Number.isInteger(left.endMinutes) && Number.isInteger(right.startMinutes) && Number.isInteger(right.endMinutes) && left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes && recurrencesOverlap(left, right)
}

export function findTimetableConflicts(sessions) {
  const conflicts = []
  for (let left = 0; left < sessions.length; left += 1) {
    for (let right = left + 1; right < sessions.length; right += 1) {
      if (sessionsConflict(sessions[left], sessions[right])) conflicts.push({ first: sessions[left], second: sessions[right] })
    }
  }
  return conflicts
}

