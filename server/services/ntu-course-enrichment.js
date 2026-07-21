import { clockRangeToMinutes } from '#shared/utils/clock-time'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const USER_AGENT = 'Northstar timetable enrichment/1.0 (public NTU course lookup; responsible single-course requests)'
const globalCache = globalThis[Symbol.for('northstar.ntu-enrichment-cache')] ||= new Map()
const globalPending = globalThis[Symbol.for('northstar.ntu-enrichment-pending')] ||= new Map()

function normalizedTitle(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
function decodeHtml(value) { return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>') }
function htmlLines(html) {
  return decodeHtml(String(html || '').replace(/<\/(?:td|th|tr|p|div|li|h\d)>|<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export function isAllowedNtuPublicUrl(value) {
  let url
  try { url = new URL(value) } catch { return false }
  if (url.protocol !== 'https:') return false
  if (/(?:login|studentlink|stars|sso|auth|intranet)/i.test(url.pathname)) return false
  if (['wish.wis.ntu.edu.sg', 'wis.ntu.edu.sg'].includes(url.hostname)) return ['/webexe/owa/aus_schedule.', '/webexe/owa/aus_subj_cont'].some(prefix => url.pathname.startsWith(prefix))
  return url.hostname === 'www.ntu.edu.sg' && !/(?:login|studentlink|intranet)/i.test(url.pathname)
}

function scheduleUrl(code, academicYear, semester) {
  const year = String(academicYear).match(/\d{4}/)?.[0]
  const semesterNumber = String(semester).match(/\d+/)?.[0] || '1'
  const url = new URL('https://wish.wis.ntu.edu.sg/webexe/owa/aus_schedule.main_display1')
  url.searchParams.set('acadsem', `${year};${semesterNumber}`)
  url.searchParams.set('r_search_type', 'F')
  url.searchParams.set('boption', 'Search')
  url.searchParams.set('staff_access', 'false')
  url.searchParams.set('r_subj_code', code)
  return url.toString()
}

function contentUrl(code, academicYear, semester) {
  const year = String(academicYear).match(/\d{4}/)?.[0]
  const semesterNumber = String(semester).match(/\d+/)?.[0] || '1'
  const url = new URL('https://wish.wis.ntu.edu.sg/webexe/owa/aus_subj_cont2.main')
  url.searchParams.set('acadsem', `${year};${semesterNumber}`)
  url.searchParams.set('r_subj_code', code)
  url.searchParams.set('boption', 'Search')
  return url.toString()
}

export function parseNtuPublicCoursePage(html, code) {
  const lines = htmlLines(html)
  const codeIndex = lines.findIndex(line => new RegExp(`(?:^|\\s)${code}(?:\\s|$)`, 'i').test(line))
  if (codeIndex === -1) return null
  const nearby = lines.slice(codeIndex, codeIndex + 12)
  const combined = nearby.join(' | ')
  const units = combined.match(/\b(\d+(?:\.\d+)?)\s*AU\b/i)
  const codeLineRemainder = nearby[0].replace(new RegExp(`^.*?\\b${code}\\b`, 'i'), '').replace(/^\s*[-|:]?\s*/, '')
  const titleCandidate = [codeLineRemainder, ...nearby.slice(1)].find(line => line.length >= 2 && line.length <= 160 && !/^\d+(?:\.\d+)?\s*AU$/i.test(line) && !/^(?:INDEX|TYPE|GROUP|DAY|TIME|VENUE|REMARK)/i.test(line))
  const title = titleCandidate?.replace(/\*+$/, '').trim() || null
  const indexes = []
  let currentIndex = null
  for (const row of String(html || '').match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const cells = (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(cell => htmlLines(cell).join(' ').trim())
    const indexCell = cells.find(cell => /^\d{5}$/.test(cell))
    if (indexCell) { currentIndex = { indexNumber: indexCell, sessions: [] }; indexes.push(currentIndex) }
    if (!currentIndex) continue
    const typeIndex = cells.findIndex(cell => /^(?:LEC\/STU|LEC|TUT|LAB|SEM|PRJ|DES)$/i.test(cell))
    if (typeIndex !== -1) {
      const time = cells.find(cell => /^\d{4}\s*[-–]\s*\d{4}$/.test(cell)) || null
      const range = clockRangeToMinutes(time)
      currentIndex.sessions.push({ classType: cells[typeIndex], group: cells[typeIndex + 1] || null, day: cells.find(cell => /^(?:MON|TUE|WED|THU|FRI|SAT)$/i.test(cell)) || null, time, startMinutes: range?.startMinutes ?? null, endMinutes: range?.endMinutes ?? null, venue: cells[typeIndex + 4] || null, remark: cells.at(-1) || null, weekNumbers: [] })
    }
  }
  return { courseCode: code.toUpperCase(), title, academicUnits: units ? Number(units[1]) : null, description: null, gradingBasis: null, school: null, indexes }
}

export function parseNtuPublicCourseContentPage(html, code) {
  const lines = htmlLines(html)
  if (!lines.some(line => new RegExp(`(?:^|\\s)${code}(?:\\s|$)`, 'i').test(line))) return null
  const valueAfter = labels => {
    const index = lines.findIndex(line => labels.some(label => new RegExp(`^${label}(?:\\s*[:|-]\\s*|$)`, 'i').test(line)))
    if (index === -1) return null
    const inline = lines[index].replace(new RegExp(`^(?:${labels.join('|')})\\s*[:|-]?\\s*`, 'i'), '').trim()
    return inline || lines[index + 1] || null
  }
  const scheduleData = parseNtuPublicCoursePage(html, code) || {}
  return {
    ...scheduleData,
    description: valueAfter(['Course Description', 'Course Aims', 'Description']),
    gradingBasis: valueAfter(['Grading Basis', 'Assessment Type']),
    school: valueAfter(['School', 'College'])
  }
}

function withVerification(data, input, metadataByField, officialUrl) {
  const conflict = Boolean(input.importedTitle && data.title && normalizedTitle(input.importedTitle) !== normalizedTitle(data.title))
  const verificationStatus = conflict ? 'PUBLIC_SOURCE_CONFLICT' : 'PUBLIC_SOURCE_MATCH'
  const provenance = Object.fromEntries(['title', 'academicUnits', 'description', 'gradingBasis', 'school'].filter(field => data[field] !== null && data[field] !== undefined).map(field => [field, { ...metadataByField[field], confidence: field === 'title' ? 0.9 : 0.82, verificationStatus }]))
  const publicIndex = input.indexNumber ? data.indexes?.find(index => index.indexNumber === input.indexNumber) : null
  const indexValidation = input.indexNumber ? (publicIndex ? { status: 'MATCH', index: publicIndex } : { status: 'NOT_FOUND', message: 'This registered index was not found in the selected public semester schedule.' }) : null
  return { available: true, ...data, officialUrl, fieldProvenance: provenance, verificationStatus, indexValidation, message: conflict ? 'NTU public information differs from the imported title.' : 'Matched against NTU public course information' }
}

function createLimiter(maxConcurrency) {
  let active = 0
  const queue = []
  const runNext = () => {
    if (active >= maxConcurrency || !queue.length) return
    active += 1
    const { operation, resolve, reject } = queue.shift()
    operation().then(resolve, reject).finally(() => { active -= 1; runNext() })
  }
  return operation => new Promise((resolve, reject) => { queue.push({ operation, resolve, reject }); runNext() })
}

export function createNtuCourseEnrichmentService({ fetchImpl = globalThis.fetch, cache = globalCache, pending = globalPending, now = () => new Date(), ttlMs = CACHE_TTL_MS, timeoutMs = 8_000, maxConcurrency = 2 } = {}) {
  const limit = createLimiter(maxConcurrency)
  async function fetchPage(sourceUrl) {
    if (!isAllowedNtuPublicUrl(sourceUrl)) throw new Error('Public NTU source is not allowlisted.')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(sourceUrl, { headers: { 'user-agent': USER_AGENT, accept: 'text/html' }, signal: controller.signal, redirect: 'manual' })
        if (response.status >= 300 && response.status < 400) return { available: false, reason: 'Public source redirected and was not followed.' }
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt === 0) continue
        if (!response.ok) return { available: false, reason: 'NTU public course information is unavailable.' }
        return { available: true, html: await response.text(), sourceUrl }
      } catch (error) {
        if (attempt === 0 && error?.name !== 'AbortError') continue
        return { available: false, reason: 'NTU public course information is temporarily unavailable.' }
      } finally { clearTimeout(timeout) }
    }
  }
  async function fetchPublic(input) {
    const schedule = await fetchPage(scheduleUrl(input.code, input.academicYear, input.semester))
    if (!schedule.available) return schedule
    const parsedSchedule = parseNtuPublicCoursePage(schedule.html, input.code)
    if (!parsedSchedule) return { available: false, reason: 'Course code was not found in the NTU public response.' }

    const content = await fetchPage(contentUrl(input.code, input.academicYear, input.semester))
    const parsedContent = content.available ? parseNtuPublicCourseContentPage(content.html, input.code) : null
    const data = {
      ...parsedSchedule,
      description: parsedContent?.description || null,
      gradingBasis: parsedContent?.gradingBasis || null,
      school: parsedContent?.school || null
    }
    const fetchedAt = now().toISOString()
    const common = { fetchedAt, academicYear: input.academicYear, semester: input.semester }
    const scheduleMetadata = { ...common, sourceUrl: schedule.sourceUrl, sourceType: 'NTU_CLASS_SCHEDULE' }
    const contentMetadata = { ...common, sourceUrl: content.sourceUrl, sourceType: 'NTU_CONTENT_OF_COURSES' }
    return {
      data,
      officialUrl: schedule.sourceUrl,
      metadataByField: {
        title: scheduleMetadata,
        academicUnits: scheduleMetadata,
        description: contentMetadata,
        gradingBasis: contentMetadata,
        school: contentMetadata
      }
    }
  }
  async function enrich(input) {
    const key = `${input.code}:${input.academicYear}:${input.semester}`.toUpperCase()
    const cached = cache.get(key)
    if (cached && now().getTime() - cached.cachedAt < ttlMs) return cached.result.available ? withVerification(cached.result.data, input, cached.result.metadataByField, cached.result.officialUrl) : cached.result
    if (!pending.has(key)) {
      pending.set(key, limit(async () => {
        const fetched = await fetchPublic(input)
        const result = fetched.data ? { available: true, data: fetched.data, metadataByField: fetched.metadataByField, officialUrl: fetched.officialUrl } : fetched
        cache.set(key, { cachedAt: now().getTime(), result })
        return result
      }).finally(() => pending.delete(key)))
    }
    const result = await pending.get(key)
    return result.available ? withVerification(result.data, input, result.metadataByField, result.officialUrl) : result
  }
  return { enrich }
}

export const ntuCourseEnrichment = createNtuCourseEnrichmentService()
