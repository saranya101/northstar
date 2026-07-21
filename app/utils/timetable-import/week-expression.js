const WEEK_MARKER = /\b(?:WEEKS|WEEK|WK)\s*/i

export function parseWeekExpression(value) {
  const text = String(value || '').replace(/[–—]/g, '-').trim()
  const marker = text.match(WEEK_MARKER)
  if (!marker) return { matched: false, weekNumbers: [], recurrence: null, warning: null }
  const expression = text.slice(marker.index + marker[0].length).split(';')[0].trim()
  if (!expression) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week expression needs confirmation.' }
  if (!/^[\d\s,-]+$/.test(expression)) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week expression could not be understood.' }

  const weeks = []
  for (const part of expression.split(',').map(item => item.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (start < 1 || end > 20 || start > end) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week range is invalid.' }
      for (let week = start; week <= end; week += 1) weeks.push(week)
      continue
    }
    if (!/^\d+$/.test(part)) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week expression could not be understood.' }
    const week = Number(part)
    if (week < 1 || week > 20) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week number must be between 1 and 20.' }
    weeks.push(week)
  }
  if (!weeks.length) return { matched: true, weekNumbers: [], recurrence: null, warning: 'Week expression needs confirmation.' }
  return { matched: true, weekNumbers: [...new Set(weeks)].sort((left, right) => left - right), recurrence: 'CUSTOM', warning: null }
}
