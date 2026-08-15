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

export function normalizeStructuredOutlookMessage(value) {
  if (!value || typeof value !== 'object') throw new TypeError('No Outlook message was extracted.')
  const rawText = typeof value.rawText === 'string'
    ? value.rawText.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
    : ''
  if (rawText.length < 20 || rawText.length > 50_000) throw new TypeError('The open message body could not be extracted safely.')

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
