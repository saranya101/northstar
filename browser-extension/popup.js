import { NORTHSTAR_BASE_URL, createScanCancellation, isAllowedOutlookUrl, normalizeStructuredOutlookMessage } from './extension-helpers.js'

const $ = selector => document.querySelector(selector)
const elements = {
  initial: $('#initial-view'), review: $('#review-view'), success: $('#success-view'), status: $('#status-message'), outlook: $('#outlook-state'),
  auto: $('#auto-sync-toggle'), autoStatus: $('#auto-status'), lastSync: $('#last-sync-value'), sent: $('#sent-value'), created: $('#new-value'), duplicates: $('#duplicate-value'),
  subject: $('#subject-value'), sender: $('#sender-value'), body: $('#body-value'), links: $('#links-value'), preview: $('#preview-value'), classification: $('#classification-value'), diagnostics: $('#diagnostic-output')
}
let extractedMessage = null
let scanCancellation = null

function showStatus(message, error = false) { elements.status.textContent = message; elements.status.classList.toggle('error', error); elements.status.hidden = !message }
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = busy ? label : button.dataset.defaultLabel }
async function activeOutlookTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id || !isAllowedOutlookUrl(tab.url)) throw new Error('NOT_OUTLOOK'); return tab }
const request = message => chrome.runtime.sendMessage(message)

function extractionError(status) {
  if (status === 'NO_OPEN_MESSAGE') return 'No open email was found. Open one message in the reading pane and try again.'
  if (status === 'AMBIGUOUS_MESSAGE') return 'More than one message body is visible. Open one email by itself and try again.'
  if (status === 'UNSUPPORTED_OUTLOOK_DOM') return 'This Outlook layout is not recognised safely yet. Run diagnostics.'
  return 'Open an email in NTU Outlook first.'
}

async function refreshState() {
  const state = await request({ type: 'GET_STATE' })
  elements.auto.checked = state.autoSyncEnabled === true
  elements.autoStatus.textContent = state.autoSyncEnabled ? 'Auto-sync on' : 'Off'
  elements.lastSync.textContent = state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'
  elements.sent.textContent = state.sent || 0; elements.created.textContent = state.created || 0; elements.duplicates.textContent = state.duplicates || 0
}

function renderReview(message) {
  extractedMessage = message
  elements.subject.textContent = message.subject || 'Not detected'; elements.sender.textContent = message.senderName || message.senderEmail || 'Not detected'
  elements.body.textContent = `${message.rawText.length.toLocaleString()} characters`; elements.links.textContent = `${message.links.length} detected`
  elements.preview.textContent = message.rawText.length > 1200 ? `${message.rawText.slice(0, 1200)}\n\n…preview truncated` : message.rawText
  elements.initial.hidden = true; elements.success.hidden = true; elements.review.hidden = false
}

async function extract() {
  const button = $('#extract-button'); setBusy(button, true, 'Extracting…'); showStatus('')
  try { const tab = await activeOutlookTab(); const result = await request({ type: 'EXTRACT_OPEN', tabId: tab.id }); if (result?.status !== 'OK') throw new Error(result?.status); renderReview(normalizeStructuredOutlookMessage(result.message)) }
  catch (error) { showStatus(error.message === 'NOT_OUTLOOK' ? 'Open an email in NTU Outlook first.' : extractionError(error.message), true) }
  finally { setBusy(button, false, '') }
}

async function send() {
  const button = $('#send-button'); setBusy(button, true, 'Sending…'); showStatus('')
  try {
    const result = await request({ type: 'INGEST_MESSAGE', message: extractedMessage })
    if (result?.status === 'ERROR') throw new Error(result.error)
    elements.classification.textContent = result.local ? 'This message was already sent during this Outlook session.' : `${String(result.intake?.classification || 'UNCERTAIN').replaceAll('_', ' ')} review is ready.`
    elements.initial.hidden = true; elements.review.hidden = true; elements.success.hidden = false; extractedMessage = null; await refreshState()
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED') showStatus('Northstar is not signed in.', true)
    else if (error.message === 'NETWORK_ERROR') showStatus('Northstar is not running.', true)
    else showStatus('Northstar could not accept this email. Nothing was created.', true)
  } finally { setBusy(button, false, '') }
}

async function scan() {
  const scanButton = $('#scan-button'); const stopButton = $('#stop-scan-button'); scanCancellation = createScanCancellation()
  setBusy(scanButton, true, 'Scanning current folder…'); stopButton.hidden = false; showStatus('Scanning visible messages in the current folder…')
  try {
    const tab = await activeOutlookTab(); const result = await request({ type: 'SCAN_VISIBLE', tabId: tab.id })
    if (scanCancellation.isCancelled()) return showStatus('Scan stopped.')
    const count = result.visibleCandidates?.length || 0
    if (result.status === 'UNSAFE_TO_OPEN_MESSAGES') showStatus(`${count} visible emails found. Automatic opening is disabled because it may change Outlook read state.`)
    else showStatus(extractionError(result.status), result.status !== 'NO_VISIBLE_MESSAGES')
  } catch { showStatus('Open an email folder in NTU Outlook first.', true) }
  finally { setBusy(scanButton, false, ''); stopButton.hidden = true; scanCancellation = null }
}

async function diagnose() {
  const button = $('#diagnostic-button'); setBusy(button, true, 'Checking…'); elements.diagnostics.hidden = true
  try { const tab = await activeOutlookTab(); const result = await request({ type: 'EXTRACT_OPEN', tabId: tab.id, diagnostic: true }); elements.diagnostics.textContent = JSON.stringify(result?.diagnostic || { recognisedOutlookHost: false }, null, 2); elements.diagnostics.hidden = false }
  catch { showStatus('Safe diagnostics could not inspect this Outlook page.', true) }
  finally { setBusy(button, false, '') }
}

async function initialise() {
  await refreshState()
  try { await activeOutlookTab(); elements.outlook.textContent = 'NTU Outlook detected' }
  catch { elements.outlook.textContent = 'Open NTU Outlook to begin.' }
}

for (const button of document.querySelectorAll('button')) button.dataset.defaultLabel = button.textContent
$('#extract-button').addEventListener('click', extract); $('#extract-again-button').addEventListener('click', extract); $('#send-button').addEventListener('click', send); $('#scan-button').addEventListener('click', scan)
$('#stop-scan-button').addEventListener('click', () => scanCancellation?.cancel()); $('#diagnostic-button').addEventListener('click', diagnose)
elements.auto.addEventListener('change', async () => { await request({ type: 'SET_AUTO_SYNC', enabled: elements.auto.checked }); await refreshState() })
for (const id of ['#open-inbox-button', '#open-success-inbox-button']) $(id).addEventListener('click', () => chrome.tabs.create({ url: `${NORTHSTAR_BASE_URL}/app/inbox` }))
initialise()
