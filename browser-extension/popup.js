import { NORTHSTAR_BASE_URL, isAllowedOutlookUrl, normalizeStructuredOutlookMessage } from './extension-helpers.js'
import { extractOpenOutlookMessage } from './outlook-extractor.js'

const elements = {
  initial: document.querySelector('#initial-view'),
  review: document.querySelector('#review-view'),
  success: document.querySelector('#success-view'),
  status: document.querySelector('#status-message'),
  subject: document.querySelector('#subject-value'),
  sender: document.querySelector('#sender-value'),
  body: document.querySelector('#body-value'),
  links: document.querySelector('#links-value'),
  preview: document.querySelector('#preview-value'),
  classification: document.querySelector('#classification-value'),
  diagnostics: document.querySelector('#diagnostic-output')
}

let extractedMessage = null

function showStatus(message, error = false) {
  elements.status.textContent = message
  elements.status.classList.toggle('error', error)
  elements.status.hidden = !message
}

function setBusy(button, busy, label) {
  button.disabled = busy
  button.textContent = busy ? label : button.dataset.defaultLabel
}

async function activeOutlookTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !isAllowedOutlookUrl(tab.url)) throw new Error('NOT_OUTLOOK')
  return tab
}

async function runExtractor(diagnostic = false) {
  const tab = await activeOutlookTab()
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'ISOLATED',
    func: extractOpenOutlookMessage,
    args: [{ diagnostic }]
  })
  return result
}

function extractionError(status) {
  if (status === 'NO_OPEN_MESSAGE') return 'No open email was found. Open one message in the reading pane and try again.'
  if (status === 'AMBIGUOUS_MESSAGE') return 'More than one message body is visible. Open one email by itself and try again.'
  if (status === 'UNSUPPORTED_OUTLOOK_DOM') return 'This Outlook layout is not recognised safely yet. Run the diagnostic and share only its counts.'
  return 'Open an email in NTU Outlook first.'
}

function renderReview(message) {
  extractedMessage = message
  elements.subject.textContent = message.subject || 'Not detected'
  elements.sender.textContent = message.senderName || message.senderEmail || 'Not detected'
  elements.body.textContent = `${message.rawText.length.toLocaleString()} characters`
  elements.links.textContent = `${message.links.length} detected`
  elements.preview.textContent = message.rawText.length > 1200 ? `${message.rawText.slice(0, 1200)}\n\n…preview truncated` : message.rawText
  elements.initial.hidden = true
  elements.success.hidden = true
  elements.review.hidden = false
}

async function extract() {
  const button = document.querySelector('#extract-button')
  setBusy(button, true, 'Extracting…')
  showStatus('')
  try {
    const result = await runExtractor(false)
    if (result?.status !== 'OK') throw new Error(result?.status || 'UNSUPPORTED_OUTLOOK_DOM')
    renderReview(normalizeStructuredOutlookMessage(result.message))
  } catch (error) {
    showStatus(error?.message === 'NOT_OUTLOOK' ? 'Open an email in NTU Outlook first.' : extractionError(error?.message), true)
  } finally {
    setBusy(button, false, '')
  }
}

async function send() {
  const button = document.querySelector('#send-button')
  setBusy(button, true, 'Sending…')
  showStatus('')
  try {
    const response = await fetch(`${NORTHSTAR_BASE_URL}/api/mail-intake/batch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [extractedMessage] })
    })
    if (response.status === 401) throw new Error('AUTH_REQUIRED')
    if (response.status === 403) throw new Error('AUTH_FORBIDDEN')
    if (!response.ok) throw new Error('SERVER_REJECTED')
    const items = await response.json()
    const intake = Array.isArray(items) ? items[0] : items?.items?.[0]
    if (!intake) throw new Error('SERVER_REJECTED')
    await chrome.storage.local.set({ northstarLastConnectionAt: new Date().toISOString() })
    elements.classification.textContent = `${String(intake.classification || 'UNCERTAIN').replaceAll('_', ' ')} review is ready.`
    elements.initial.hidden = true
    elements.review.hidden = true
    elements.success.hidden = false
    extractedMessage = null
  } catch (error) {
    if (error?.message === 'AUTH_REQUIRED') showStatus("Northstar isn't signed in. Open Northstar and sign in.", true)
    else if (error?.message === 'AUTH_FORBIDDEN') showStatus('Northstar denied this request. Confirm you are signed in and extension access is allowed.', true)
    else if (error instanceof TypeError) showStatus("Northstar isn't running at localhost:3000.", true)
    else showStatus('Northstar could not accept this email. Nothing was created.', true)
  } finally {
    setBusy(button, false, '')
  }
}

async function diagnose() {
  const button = document.querySelector('#diagnostic-button')
  setBusy(button, true, 'Checking…')
  elements.diagnostics.hidden = true
  showStatus('')
  try {
    const result = await runExtractor(true)
    elements.diagnostics.textContent = JSON.stringify(result?.diagnostic || { recognisedOutlookHost: false }, null, 2)
    elements.diagnostics.hidden = false
  } catch (error) {
    showStatus(error?.message === 'NOT_OUTLOOK' ? 'Open an email in NTU Outlook first.' : 'Safe diagnostics could not inspect this Outlook page.', true)
  } finally {
    setBusy(button, false, '')
  }
}

for (const button of document.querySelectorAll('button')) button.dataset.defaultLabel = button.textContent
document.querySelector('#extract-button').addEventListener('click', extract)
document.querySelector('#extract-again-button').addEventListener('click', extract)
document.querySelector('#send-button').addEventListener('click', send)
document.querySelector('#diagnostic-button').addEventListener('click', diagnose)
document.querySelector('#open-inbox-button').addEventListener('click', () => chrome.tabs.create({ url: `${NORTHSTAR_BASE_URL}/app/inbox` }))
