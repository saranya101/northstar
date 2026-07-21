import { describe, expect, it, vi } from 'vitest'
import { assertPublicUrl, fetchPublicHtml, fetchPublicJson, isBlockedIpAddress, normalizePublicUrl } from '../server/services/opportunity-link-fetcher'

const publicLookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
const htmlResponse = (html = '<html><title>Public</title></html>', init = {}) => { const { headers, ...options } = init; return new Response(html, { status: 200, ...options, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } }) }

describe('opportunity link SSRF protection', () => {
  it.each(['http://localhost/test', 'http://127.0.0.1/test', 'http://[::1]/test', 'http://10.0.0.1', 'http://172.16.8.2', 'http://192.168.1.2', 'http://169.254.10.4', 'http://169.254.169.254/latest/meta-data'])('blocks non-public address %s', async url => {
    await expect(assertPublicUrl(url, { lookup: publicLookup })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('recognises private, link-local, carrier and mapped IP ranges', () => {
    for (const address of ['10.1.2.3', '100.64.0.1', '127.4.3.2', '169.254.1.1', '172.31.255.1', '192.168.50.4', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) expect(isBlockedIpAddress(address)).toBe(true)
    expect(isBlockedIpAddress('93.184.216.34')).toBe(false)
  })

  it('blocks DNS names that resolve to private or metadata addresses', async () => {
    const privateLookup = vi.fn().mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    await expect(assertPublicUrl('https://example.test/path', { lookup: privateLookup })).rejects.toMatchObject({ statusCode: 400 })
    await expect(assertPublicUrl('https://metadata.google.internal/', { lookup: publicLookup })).rejects.toMatchObject({ statusCode: 400 })
  })

  it.each(['file:///etc/passwd', 'ftp://example.com/file', 'data:text/html,hello'])('rejects non-HTTP protocol %s', value => {
    expect(() => normalizePublicUrl(value)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })

  it('revalidates redirect destinations before a second request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }))
    await expect(fetchPublicHtml('https://example.com/start', { fetchImpl, lookup: publicLookup })).rejects.toMatchObject({ statusCode: 400 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('limits redirect chains', async () => {
    const fetchImpl = vi.fn().mockImplementation(url => Promise.resolve(new Response(null, { status: 302, headers: { location: `${url.origin}/next` } })))
    await expect(fetchPublicHtml('https://example.com/start', { fetchImpl, lookup: publicLookup, limits: { redirects: 1, bytes: 1000, timeoutMs: 100 } })).rejects.toMatchObject({ statusCode: 422 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects declared and streamed oversized responses', async () => {
    const declared = vi.fn().mockResolvedValue(htmlResponse('small', { headers: { 'content-length': '1001' } }))
    await expect(fetchPublicHtml('https://example.com', { fetchImpl: declared, lookup: publicLookup, limits: { redirects: 1, bytes: 1000, timeoutMs: 100 } })).rejects.toMatchObject({ statusCode: 413 })
    const streamed = vi.fn().mockResolvedValue(htmlResponse('x'.repeat(1001)))
    await expect(fetchPublicHtml('https://example.com', { fetchImpl: streamed, lookup: publicLookup, limits: { redirects: 1, bytes: 1000, timeoutMs: 100 } })).rejects.toMatchObject({ statusCode: 413 })
  })

  it('rejects non-HTML and authenticated responses', async () => {
    const json = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await expect(fetchPublicHtml('https://example.com/data', { fetchImpl: json, lookup: publicLookup })).rejects.toMatchObject({ statusCode: 415 })
    const login = vi.fn().mockResolvedValue(htmlResponse('<form><input type="password"></form>'))
    await expect(fetchPublicHtml('https://example.com/page', { fetchImpl: login, lookup: publicLookup })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('returns a safe timeout error', async () => {
    const timeout = Object.assign(new Error('network internals'), { name: 'AbortError' })
    await expect(fetchPublicHtml('https://example.com', { fetchImpl: vi.fn().mockRejectedValue(timeout), lookup: publicLookup })).rejects.toMatchObject({ statusCode: 504, statusMessage: 'The website took too long to respond.' })
  })

  it('fetches bounded public JSON without sending cookies or credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"items":[]}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await expect(fetchPublicJson('https://example.com/public.json', { fetchImpl, lookup: publicLookup })).resolves.toMatchObject({ data: { items: [] } })
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'GET', redirect: 'manual', headers: { accept: 'application/json', 'user-agent': 'NorthstarOpportunityImporter/1.0' } }))
    expect(JSON.stringify(fetchImpl.mock.calls[0][1].headers)).not.toMatch(/cookie|credential|authori[sz]ation/i)
  })
})
