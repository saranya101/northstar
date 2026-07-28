import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createError } from 'h3'

function normalizeOpportunityUrl(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
    return url.toString()
  } catch { return trimmed }
}

export const LINK_FETCH_LIMITS = Object.freeze({ redirects: 3, bytes: 1_000_000, timeoutMs: 5_000 })
const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata.aws.internal'])

function requestError(statusCode, statusMessage) { return createError({ statusCode, statusMessage }) }
function ipv4Number(address) { return address.split('.').reduce((result, part) => (result * 256) + Number(part), 0) >>> 0 }
function inRange(value, base, bits) { const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0; return (value & mask) === (ipv4Number(base) & mask) }

export function isBlockedIpAddress(address) {
  const unwrapped = address.replace(/^\[|\]$/g, '').toLowerCase()
  if (unwrapped.startsWith('::ffff:')) return isBlockedIpAddress(unwrapped.slice(7))
  const version = isIP(unwrapped)
  if (version === 4) {
    const value = ipv4Number(unwrapped)
    return [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]].some(([base, bits]) => inRange(value, base, bits))
  }
  if (version === 6) return unwrapped === '::' || unwrapped === '::1' || /^f[cd]/.test(unwrapped) || /^fe[89ab]/.test(unwrapped)
  return true
}

export function normalizePublicUrl(value) {
  let url
  try { url = new URL(normalizeOpportunityUrl(value)) } catch { throw requestError(400, 'Enter a valid public URL.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw requestError(400, 'Only HTTP and HTTPS URLs are supported.')
  if (url.username || url.password) throw requestError(400, 'URLs containing credentials are not supported.')
  return url
}

export async function assertPublicUrl(value, { lookup = dnsLookup } = {}) {
  const url = value instanceof URL ? value : normalizePublicUrl(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw requestError(400, 'That address is not a public website.')
  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) throw requestError(400, 'That address is not a public website.')
    return url
  }
  let addresses
  try { addresses = await lookup(hostname, { all: true, verbatim: true }) } catch { throw requestError(422, 'The website address could not be resolved.') }
  if (!addresses?.length || addresses.some(result => isBlockedIpAddress(result.address))) throw requestError(400, 'That address is not a public website.')
  return url
}

async function readLimitedBody(response, maximum) {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maximum) throw requestError(413, 'The webpage is too large to import.')
  if (!response.body?.getReader) {
    const buffer = new Uint8Array(await response.arrayBuffer())
    if (buffer.byteLength > maximum) throw requestError(413, 'The webpage is too large to import.')
    return new TextDecoder().decode(buffer)
  }
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximum) { await reader.cancel(); throw requestError(413, 'The webpage is too large to import.') }
    chunks.push(value)
  }
  const buffer = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(buffer)
}

export async function fetchPublicHtml(input, { fetchImpl = globalThis.fetch, lookup = dnsLookup, limits = LINK_FETCH_LIMITS } = {}) {
  let current = normalizePublicUrl(input)
  for (let redirect = 0; redirect <= limits.redirects; redirect += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs)
    let response
    try {
      await Promise.race([
        assertPublicUrl(current, { lookup }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('Timed out'), { name: 'AbortError' })), { once: true }))
      ])
      response = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'NorthstarOpportunityImporter/1.0' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === limits.redirects) throw requestError(422, 'The website redirected too many times.')
        const location = response.headers.get('location')
        if (!location) throw requestError(422, 'The website returned an invalid redirect.')
        await response.body?.cancel()
        current = normalizePublicUrl(new URL(location, current).toString())
        continue
      }
      if ([401, 403].includes(response.status) || /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(current.pathname)) throw requestError(422, 'This page appears to require authentication.')
      if (!response.ok) throw requestError(422, 'The website could not be imported.')
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw requestError(415, 'Only HTML webpages can be imported.')
      const html = await readLimitedBody(response, limits.bytes)
      if (/<input\b[^>]*type=["']password["']/i.test(html)) throw requestError(422, 'This page appears to require authentication.')
      return { html, finalUrl: normalizeOpportunityUrl(current.toString()) }
    } catch (error) {
      if (error?.statusCode) throw error
      if (error?.name === 'AbortError' || controller.signal.aborted) throw requestError(504, 'The website took too long to respond.')
      throw requestError(422, 'The website could not be reached.')
    } finally { clearTimeout(timer) }
  }
  throw requestError(422, 'The website redirected too many times.')
}

export async function fetchPublicJson(input, { fetchImpl = globalThis.fetch, lookup = dnsLookup, limits = LINK_FETCH_LIMITS } = {}) {
  let current = normalizePublicUrl(input)
  for (let redirect = 0; redirect <= limits.redirects; redirect += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs)
    let response
    try {
      await Promise.race([
        assertPublicUrl(current, { lookup }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('Timed out'), { name: 'AbortError' })), { once: true }))
      ])
      response = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'NorthstarOpportunityImporter/1.0' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === limits.redirects) throw requestError(422, 'The website redirected too many times.')
        const location = response.headers.get('location')
        if (!location) throw requestError(422, 'The website returned an invalid redirect.')
        await response.body?.cancel()
        current = normalizePublicUrl(new URL(location, current).toString())
        continue
      }
      if ([401, 403].includes(response.status) || /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(current.pathname)) throw requestError(422, 'This page appears to require authentication.')
      if (!response.ok) throw requestError(422, 'The website could not be imported.')
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      if (!contentType.includes('application/json') && !contentType.includes('+json')) throw requestError(415, 'Only JSON resources can be imported.')
      const body = await readLimitedBody(response, limits.bytes)
      try { return { data: JSON.parse(body), finalUrl: normalizeOpportunityUrl(current.toString()) } } catch { throw requestError(422, 'The website returned invalid data.') }
    } catch (error) {
      if (error?.statusCode) throw error
      if (error?.name === 'AbortError' || controller.signal.aborted) throw requestError(504, 'The website took too long to respond.')
      throw requestError(422, 'The website could not be reached.')
    } finally { clearTimeout(timer) }
  }
  throw requestError(422, 'The website redirected too many times.')
}

export async function fetchPublicCalendar(input, { fetchImpl = globalThis.fetch, lookup = dnsLookup, limits = LINK_FETCH_LIMITS } = {}) {
  let current = normalizePublicUrl(input)
  for (let redirect = 0; redirect <= limits.redirects; redirect += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs)
    let response
    try {
      await Promise.race([
        assertPublicUrl(current, { lookup }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('Timed out'), { name: 'AbortError' })), { once: true }))
      ])
      response = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { accept: 'text/calendar', 'user-agent': 'NorthstarOpportunityImporter/1.0' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === limits.redirects) throw requestError(422, 'The website redirected too many times.')
        const location = response.headers.get('location')
        if (!location) throw requestError(422, 'The website returned an invalid redirect.')
        await response.body?.cancel()
        current = normalizePublicUrl(new URL(location, current).toString())
        continue
      }
      if ([401, 403].includes(response.status) || /\/(?:login|signin|auth)(?:[/?#]|$)/i.test(current.pathname)) throw requestError(422, 'This page appears to require authentication.')
      if (!response.ok) throw requestError(422, 'The calendar could not be imported.')
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      if (!contentType.includes('text/calendar')) throw requestError(415, 'Only public calendar feeds can be imported.')
      const text = await readLimitedBody(response, limits.bytes)
      if (!/^BEGIN:VCALENDAR\b/m.test(text)) throw requestError(422, 'The website returned invalid calendar data.')
      return { text, finalUrl: normalizeOpportunityUrl(current.toString()) }
    } catch (error) {
      if (error?.statusCode) throw error
      if (error?.name === 'AbortError' || controller.signal.aborted) throw requestError(504, 'The website took too long to respond.')
      throw requestError(422, 'The website could not be reached.')
    } finally { clearTimeout(timer) }
  }
  throw requestError(422, 'The website redirected too many times.')
}
