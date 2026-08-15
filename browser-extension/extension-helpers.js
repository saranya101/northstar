export const NORTHSTAR_BASE_URL = 'http://localhost:3000'

export const normalizeAutoSyncPreference = value => value === true

export function createMemoryDeduper() {
  const keys = new Set()
  return {
    has: key => keys.has(key),
    add: key => { keys.add(key) },
    size: () => keys.size
  }
}

export function summarizeBatchItem(item) {
  return { duplicate: item?.duplicate === true, created: item?.duplicate !== true && Boolean(item?.id || item?.mailIntakeId) }
}

export function createScanCancellation() {
  let cancelled = false
  return { cancel: () => { cancelled = true }, isCancelled: () => cancelled }
}

export function readingPaneHasSettled(lastMutationAt, now = Date.now(), minimumDelay = 750) {
  return Number.isFinite(lastMutationAt) && now - lastMutationAt >= minimumDelay
}

const OUTLOOK_HOSTS = new Set([
  'outlook.office.com',
  'outlook.office365.com',
  'outlook.cloud.microsoft'
])

export function isAllowedOutlookUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && OUTLOOK_HOSTS.has(url.hostname.toLowerCase()) && /^\/(?:mail|owa)(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

export function sanitizeHttpLink(link) {
  try {
    const url = new URL(String(link?.url || ''))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return {
      text: String(link?.text || '').replace(/\s+/g, ' ').trim().slice(0, 500),
      url: url.href.slice(0, 2000)
    }
  } catch {
    return null
  }
}

const nullableText = (value, maximum) => {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : ''
  return normalized || null
}

export function isPlausibleOutlookBody(value) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (text.length < 40 || text.length > 50_000) return false
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’&/-]*/gu) || []
  if (words.length < 7 || new Set(words.map(word => word.toLocaleLowerCase())).size < 5) return false
  const chromeOnly = /^(?:new mail|inbox|focused|other|filter|sort|select|reply|reply all|forward|archive|delete|mark as unread|more actions|previous|next|close|open in new window|print|apps?)(?:\s*[·|,;:]?\s*)+$/i
  if (chromeOnly.test(text)) return false
  const chromeTokens = text.match(/\b(?:reply|reply all|forward|archive|delete|mark as unread|more actions|previous|next|close|open in new window|print)\b/gi) || []
  const proseSignals = [/[.!?](?:\s|$)/, /\b(?:dear|hello|hi|regards|thank|please|kindly|we|you|your)\b/i, /\n/].filter(pattern => pattern.test(value)).length
  return proseSignals >= 1 && chromeTokens.length * 3 < words.length
}

export function normalizeStructuredOutlookMessage(value) {
  if (!value || typeof value !== 'object') throw new TypeError('No Outlook message was extracted.')
  const rawText = typeof value.rawText === 'string'
    ? value.rawText.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
    : ''
  if (!isPlausibleOutlookBody(rawText)) {
    const error = new TypeError('The open message body could not be extracted safely.')
    error.code = 'INCOMPLETE_MESSAGE'
    throw error
  }

  const received = value.receivedAt ? new Date(value.receivedAt) : null
  const receivedAt = received && !Number.isNaN(received.getTime()) ? received.toISOString() : null
  const links = []
  const seenLinks = new Set()
  for (const candidate of Array.isArray(value.links) ? value.links : []) {
    const link = sanitizeHttpLink(candidate)
    if (!link || seenLinks.has(link.url)) continue
    seenLinks.add(link.url)
    links.push(link)
    if (links.length === 100) break
  }

  return {
    subject: nullableText(value.subject, 300),
    senderName: nullableText(value.senderName, 240),
    senderEmail: nullableText(value.senderEmail, 320),
    receivedAt,
    rawText,
    links
  }
}
