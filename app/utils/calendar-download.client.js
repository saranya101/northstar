import { createIcsCalendar, safeIcsFileName } from '#shared/calendar/ics'

export function downloadAcademicCalendar(events, {
  fileName = 'northstar-calendar',
  calendarName = 'Northstar Academic Calendar'
} = {}) {
  if (!import.meta.client || !Array.isArray(events) || events.length === 0) return false

  const contents = createIcsCalendar(events, { calendarName })
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = url
    anchor.download = safeIcsFileName(fileName)
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    return true
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}
