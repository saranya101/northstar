import { NORTHSTAR_BASE_URL, createMemoryDeduper, normalizeAutoSyncPreference, normalizeStructuredOutlookMessage, summarizeBatchItem } from './extension-helpers.js'
import { extractOpenOutlookMessage } from './outlook-extractor.js'

const session = { sent: 0, created: 0, duplicates: 0, lastError: null }
const sentFingerprints = createMemoryDeduper()
const pendingTabs = new Map()

async function fingerprint(message) {
  const value = JSON.stringify([message.subject, message.senderEmail, message.receivedAt, message.rawText, message.links])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function extractFromTab(tabId, diagnostic = false) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'ISOLATED', func: extractOpenOutlookMessage, args: [{ diagnostic }]
  })
  return result
}

async function sendMessage(message) {
  const normalized = normalizeStructuredOutlookMessage(message)
  const localKey = await fingerprint(normalized)
  if (sentFingerprints.has(localKey)) return { status: 'DUPLICATE', duplicate: true, local: true }
  const response = await fetch(`${NORTHSTAR_BASE_URL}/api/mail-intake/batch`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [normalized] })
  })
  if (response.status === 401) throw new Error('AUTH_REQUIRED')
  if (response.status === 403) throw new Error('AUTH_FORBIDDEN')
  if (!response.ok) throw new Error('SERVER_REJECTED')
  const payload = await response.json()
  const intake = Array.isArray(payload) ? payload[0] : payload?.items?.[0]
  if (!intake) throw new Error('SERVER_REJECTED')
  sentFingerprints.add(localKey)
  const outcome = summarizeBatchItem(intake)
  session.sent += 1
  if (outcome.duplicate) session.duplicates += 1
  else session.created += 1
  session.lastError = null
  await chrome.storage.local.set({ lastSyncAt: new Date().toISOString() })
  return { status: 'SENT', duplicate: Boolean(intake.duplicate), intake }
}

async function autoSync(tabId) {
  const { autoSyncEnabled = false } = await chrome.storage.local.get('autoSyncEnabled')
  if (!normalizeAutoSyncPreference(autoSyncEnabled)) return
  const result = await extractFromTab(tabId)
  if (result?.status !== 'OK') return
  try { await sendMessage(result.message) } catch (error) { session.lastError = error instanceof TypeError ? 'NETWORK_ERROR' : error.message }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  ;(async () => {
    if (message?.type === 'OUTLOOK_STATE_CHANGED' && sender.tab?.id) {
      clearTimeout(pendingTabs.get(sender.tab.id))
      pendingTabs.set(sender.tab.id, setTimeout(() => { pendingTabs.delete(sender.tab.id); autoSync(sender.tab.id) }, 750))
      return { status: 'SCHEDULED' }
    }
    if (message?.type === 'GET_STATE') {
      const preferences = await chrome.storage.local.get(['autoSyncEnabled', 'lastSyncAt'])
      return { ...session, autoSyncEnabled: normalizeAutoSyncPreference(preferences.autoSyncEnabled), lastSyncAt: preferences.lastSyncAt || null }
    }
    if (message?.type === 'SET_AUTO_SYNC') {
      await chrome.storage.local.set({ autoSyncEnabled: message.enabled === true })
      return { status: 'UPDATED', autoSyncEnabled: message.enabled === true }
    }
    if (message?.type === 'EXTRACT_OPEN') return extractFromTab(message.tabId, message.diagnostic === true)
    if (message?.type === 'INGEST_MESSAGE') return sendMessage(message.message)
    if (message?.type === 'SCAN_VISIBLE') {
      try { return await chrome.tabs.sendMessage(message.tabId, { type: 'DISCOVER_VISIBLE_ROWS' }) }
      catch { return { status: 'UNSUPPORTED_OUTLOOK_DOM', visibleCandidates: [] } }
    }
    return { status: 'UNKNOWN_REQUEST' }
  })().then(respond).catch(error => respond({ status: 'ERROR', error: error instanceof TypeError ? 'NETWORK_ERROR' : error.message }))
  return true
})
