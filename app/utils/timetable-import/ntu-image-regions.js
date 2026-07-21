const DAY_HEADER = /^(?:MON|TUE|WED|THU|FRI|SAT)$/i
const clean = value => String(value || '').toUpperCase().replace(/[^A-Z0-9@\\/]/g, '')
const centre = word => ({ x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 })

function findWord(words, patterns) {
  return words.find(word => patterns.some(pattern => pattern.test(clean(word.text))))
}

export function tableGeometry(words, registeredCoursesRegion) {
  if (!registeredCoursesRegion) return null
  const scoped = words.filter(word => word.bbox && word.bbox.y0 >= registeredCoursesRegion.y0 && word.bbox.x0 < registeredCoursesRegion.x1)
  const headers = {
    index: findWord(scoped, [/^INDEX$/]), course: findWord(scoped, [/^COURSE$/]), title: findWord(scoped, [/^TITLE$/]),
    academicUnits: findWord(scoped, [/^AUS?$/]), status: findWord(scoped, [/^STATUS$/]), exam: findWord(scoped, [/^@?EXAM$/])
  }
  if (Object.values(headers).filter(Boolean).length < 5) return null
  const centres = Object.fromEntries(Object.entries(headers).map(([key, word]) => [key, centre(word).x]))
  const order = ['index', 'course', 'title', 'academicUnits', 'status', 'exam']
  const boundaries = [registeredCoursesRegion.x0]
  for (let index = 1; index < order.length; index += 1) boundaries.push((centres[order[index - 1]] + centres[order[index]]) / 2)
  boundaries.push(registeredCoursesRegion.x1)
  const headerY = Math.max(...Object.values(headers).filter(Boolean).map(word => word.bbox.y1))
  const total = scoped.find(word => /^TOTAL$/i.test(word.text))
  const bodyBottom = total?.bbox.y0 || registeredCoursesRegion.y1
  const firstColumnWords = scoped.filter(word => centre(word).x >= boundaries[0] && centre(word).x < boundaries[1] && word.bbox.y0 > headerY && word.bbox.y0 < bodyBottom)
    .sort((left, right) => left.bbox.y0 - right.bbox.y0)
  const anchors = []
  for (const word of firstColumnWords) {
    const y = centre(word).y
    if (!anchors.length || y - anchors.at(-1).y > 12) anchors.push({ y, word })
  }
  const rows = anchors.map((anchor, index) => ({
    y0: index ? (anchors[index - 1].y + anchor.y) / 2 : headerY,
    y1: index < anchors.length - 1 ? (anchor.y + anchors[index + 1].y) / 2 : bodyBottom,
    anchor: anchor.word
  }))
  const columns = Object.fromEntries(order.map((key, index) => [key, { x0: boundaries[index], x1: boundaries[index + 1] }]))
  return { headers, columns, rows, headerY, total }
}

export function detectNtuImageRegions(words = [], dimensions = {}) {
  const positioned = words.filter(word => word.bbox)
  const width = dimensions.width || Math.max(1, ...positioned.map(word => word.bbox.x1))
  const height = dimensions.height || Math.max(1, ...positioned.map(word => word.bbox.y1))
  const days = positioned.filter(word => DAY_HEADER.test(clean(word.text)))
  const timeDay = findWord(positioned, [/^TIME\\?DAY$/, /^TIMEDAY$/])
  const academic = findWord(positioned, [/^ACADEMIC$/])
  const year = academic && positioned.find(word => clean(word.text) === 'YEAR' && Math.abs(centre(word).y - centre(academic).y) < 30)
  const legend = findWord(positioned, [/^LEGEND$/])
  const index = findWord(positioned, [/^INDEX$/])
  const total = findWord(positioned, [/^TOTAL$/])
  const warnings = []
  if (days.length < 5) warnings.push('Some weekday headers were not recognised.')
  if (!academic || !year) warnings.push('The registered-course table heading was not recognised confidently.')
  const gridTop = Math.max(0, Math.min(...[timeDay, ...days].filter(Boolean).map(word => word.bbox.y0), height * 0.03) - 8)
  const summaryTop = academic ? Math.max(0, academic.bbox.y0 - 12) : height * 0.68
  const legendX = legend?.bbox.x0 || width * 0.57
  const summaryBottom = total ? Math.min(height, total.bbox.y1 + 15) : height
  const timetableGridRegion = { x0: 0, y0: gridTop, x1: width, y1: summaryTop }
  const registeredCoursesRegion = { x0: 0, y0: summaryTop, x1: Math.max(width * 0.5, legendX - 6), y1: summaryBottom }
  const legendRegion = legend ? { x0: Math.max(0, legendX - 6), y0: summaryTop, x1: width, y1: Math.min(height, summaryTop + height * 0.16) } : null
  const confidence = Math.min(1, (Number(Boolean(timeDay)) + Math.min(days.length, 6) + Number(Boolean(academic && year)) * 2 + Number(Boolean(index)) + Number(Boolean(legend))) / 11)
  return { timetableGridRegion, registeredCoursesRegion, legendRegion, confidence, warnings }
}

export function wordsInRegion(words, region) {
  if (!region) return []
  return words.filter(word => word.bbox && centre(word).x >= region.x0 && centre(word).x <= region.x1 && centre(word).y >= region.y0 && centre(word).y <= region.y1)
}
