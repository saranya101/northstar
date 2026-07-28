import { normalizeDay, parseTime } from './timetable-time'

export function itemCentre(item) {
  return { x: (item.bbox.x0 + item.bbox.x1) / 2, y: (item.bbox.y0 + item.bbox.y1) / 2 }
}

export function median(values) {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}

function clean(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function calibrateWeekdayColumns(words = [], region) {
  const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const positioned = words.filter(word => word.bbox).map(word => ({ ...word, ...itemCentre(word), day: normalizeDay(clean(word.text)) }))
  const headerCandidates = positioned.filter(word => dayOrder.includes(word.day))
  const headerRows = []
  for (const word of headerCandidates) {
    let row = headerRows.find(item => Math.abs(item.y - word.y) <= 20)
    if (!row) { row = { y: word.y, words: [] }; headerRows.push(row) }
    if (!row.words.some(item => item.day === word.day && Math.abs(item.x - word.x) <= 10)) row.words.push(word)
  }
  const detected = (headerRows.sort((left, right) => new Set(right.words.map(word => word.day)).size - new Set(left.words.map(word => word.day)).size || left.y - right.y)[0]?.words || []).sort((left, right) => left.x - right.x)
  if (detected.length < 4) return []
  const steps = []
  for (let left = 0; left < detected.length; left += 1) {
    for (let right = left + 1; right < detected.length; right += 1) {
      const difference = dayOrder.indexOf(detected[right].day) - dayOrder.indexOf(detected[left].day)
      if (difference > 0) steps.push((detected[right].x - detected[left].x) / difference)
    }
  }
  const step = median(steps)
  if (!step || step <= 0) return []
  const origin = median(detected.map(header => header.x - dayOrder.indexOf(header.day) * step))
  const headers = dayOrder.map((day, index) => detected.find(header => header.day === day) || { day, x: origin + index * step, bbox: detected[0].bbox, inferred: true })
  return headers.map((header, index) => ({
    day: header.day,
    x0: index ? (headers[index - 1].x + header.x) / 2 : Math.max(region.x0, header.x - step / 2),
    x1: index < headers.length - 1 ? (header.x + headers[index + 1].x) / 2 : Math.min(region.x1, header.x + step / 2),
    header
  }))
}

export function inferredRowHeight(times) {
  const values = []
  const sorted = [...times].sort((left, right) => left.minutes - right.minutes)
  for (let index = 1; index < sorted.length; index += 1) {
    const minuteDifference = sorted[index].minutes - sorted[index - 1].minutes
    const pixelDifference = Math.abs(sorted[index].y - sorted[index - 1].y)
    if (minuteDifference >= 30 && minuteDifference <= 120 && pixelDifference > 0) values.push(pixelDifference / (minuteDifference / 30))
  }
  return median(values)
}

export function gridMinutesAtY(y, times, rowHeight) {
  if (!times.length || !rowHeight) return null
  const nearest = times.reduce((best, time) => !best || Math.abs(time.y - y) < Math.abs(best.y - y) ? time : best, null)
  const value = nearest.minutes + Math.round((y - nearest.y) / rowHeight) * 30
  return value >= 480 && value <= 1410 ? value : null
}

export function calibrateTimeScale(words, columns, region) {
  if (!columns.length) return { labels: [], rowHeight: null }
  const labels = words.filter(word => word.bbox).map(word => ({ ...word, ...itemCentre(word) }))
    .filter(word => word.x < columns[0].x0 && word.y > region.y0 && word.y < region.y1)
    .map(word => ({ ...word, minutes: /^\d{4}$/.test(clean(word.text)) ? parseTime(clean(word.text)) : null }))
    .filter(word => word.minutes !== null)
  return { labels, rowHeight: inferredRowHeight(labels) }
}

function stableBlockId(day, bbox) {
  const rounded = value => Math.round(value / 2) * 2
  return `ntu-block-${day.toLowerCase()}-${rounded(bbox.x0)}-${rounded(bbox.y0)}-${rounded(bbox.x1)}-${rounded(bbox.y1)}`
}

function whiteFraction(context, x0, x1, y) {
  const width = Math.max(1, Math.floor(x1) - Math.ceil(x0) + 1)
  const pixels = context.getImageData(Math.ceil(x0), y, width, 1).data
  let white = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset] >= 249 && pixels[offset + 1] >= 249 && pixels[offset + 2] >= 249) white += 1
  }
  return white / width
}

export function detectNtuClassRectangles(canvas, words, region) {
  const columns = calibrateWeekdayColumns(words, region)
  if (columns.length < 6) return { columns, blocks: [], warnings: ['The weekday grid could not be calibrated for physical block detection.'] }
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const { labels, rowHeight } = calibrateTimeScale(words, columns, region)
  const headerBottom = Math.max(...columns.map(column => column.header.bbox.y1))
  const blocks = []
  for (const column of columns) {
    const stripeRight = Math.min(canvas.width - 2, Math.floor(column.x1) - 3)
    const stripeLeft = Math.max(0, stripeRight - 4)
    const activeRows = []
    for (let y = Math.max(0, Math.ceil(headerBottom + 2)); y < Math.min(canvas.height, Math.floor(region.y1 - 1)); y += 1) {
      if (whiteFraction(context, stripeLeft, stripeRight, y) >= 0.8) activeRows.push(y)
    }
    const runs = []
    for (const y of activeRows) {
      const previous = runs.at(-1)
      if (!previous || y - previous.y1 > 1) runs.push({ y0: y, y1: y })
      else previous.y1 = y
    }
    for (const run of runs.filter(value => value.y1 - value.y0 + 1 >= 24)) {
      const bbox = { x0: Math.ceil(column.x0 + 1), y0: run.y0, x1: Math.floor(column.x1 - 1), y1: run.y1 + 1 }
      const startMinutes = gridMinutesAtY(bbox.y0, labels, rowHeight)
      const endMinutes = gridMinutesAtY(bbox.y1, labels, rowHeight)
      blocks.push({
        blockId: stableBlockId(column.day, bbox),
        dayOfWeek: column.day,
        bbox,
        geometryStartMinutes: startMinutes,
        geometryEndMinutes: endMinutes && startMinutes !== null && endMinutes > startMinutes ? endMinutes : null,
        geometryTimeReliable: labels.length >= 6 && Number.isFinite(rowHeight)
      })
    }
  }
  return { columns, blocks, warnings: blocks.length ? [] : ['No physical class rectangles were detected in the weekly grid.'] }
}
