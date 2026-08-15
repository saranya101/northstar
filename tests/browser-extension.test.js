import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createMemoryDeduper, createScanCancellation, isAllowedOutlookUrl, normalizeAutoSyncPreference, normalizeStructuredOutlookMessage, readingPaneHasSettled, sanitizeHttpLink, summarizeBatchItem } from '../browser-extension/extension-helpers.js'

describe('Northstar Mail browser extension helpers', () => {
  it.each([
    'https://outlook.office.com/mail/inbox/id/AAQk',
    'https://outlook.office365.com/owa/',
    'https://outlook.cloud.microsoft/mail/'
  ])('allows the supported Outlook page %s', value => {
    expect(isAllowedOutlookUrl(value)).toBe(true)
  })

  it.each([
    'https://example.com/mail',
    'https://outlook.office.com.evil.example/mail',
    'http://outlook.office.com/mail',
    'https://outlook.office.com/calendar',
    'javascript:alert(1)'
  ])('rejects the unsupported page %s', value => {
    expect(isAllowedOutlookUrl(value)).toBe(false)
  })

  it('keeps only resolved HTTP links', () => {
    expect(sanitizeHttpLink({ text: ' Apply now ', url: 'https://example.edu.sg/apply' })).toEqual({ text: 'Apply now', url: 'https://example.edu.sg/apply' })
    expect(sanitizeHttpLink({ text: 'Email', url: 'mailto:office@example.edu.sg' })).toBeNull()
    expect(sanitizeHttpLink({ text: 'Script', url: 'javascript:alert(1)' })).toBeNull()
  })

  it('normalizes one structured message without classifying it', () => {
    expect(normalizeStructuredOutlookMessage({
      subject: '  Internship   update ', senderName: ' Careers Office ', senderEmail: 'careers@ntu.edu.sg',
      receivedAt: '2026-08-15T01:30:00+08:00', rawText: 'Hello students.\n\nApplications are now open for review.',
      links: [{ text: 'Apply', url: 'https://example.edu.sg/apply' }, { text: 'Duplicate', url: 'https://example.edu.sg/apply' }]
    })).toEqual({
      subject: 'Internship update', senderName: 'Careers Office', senderEmail: 'careers@ntu.edu.sg',
      receivedAt: '2026-08-14T17:30:00.000Z', rawText: 'Hello students.\n\nApplications are now open for review.',
      links: [{ text: 'Apply', url: 'https://example.edu.sg/apply' }]
    })
  })

  it('uses only the requested minimum permissions and contains no sensitive APIs', () => {
    const manifest = JSON.parse(readFileSync(new URL('../browser-extension/manifest.json', import.meta.url), 'utf8'))
    const source = [
      readFileSync(new URL('../browser-extension/popup.js', import.meta.url), 'utf8'),
      readFileSync(new URL('../browser-extension/outlook-extractor.js', import.meta.url), 'utf8'),
      readFileSync(new URL('../browser-extension/content-script.js', import.meta.url), 'utf8'),
      readFileSync(new URL('../browser-extension/service-worker.js', import.meta.url), 'utf8')
    ].join('\n')
    expect(manifest).toMatchObject({
      manifest_version: 3, permissions: ['activeTab', 'scripting', 'storage'],
      host_permissions: ['http://localhost:3000/*', 'https://outlook.office.com/*', 'https://outlook.office365.com/*'],
      background: { service_worker: 'service-worker.js', type: 'module' }
    })
    expect(manifest.permissions).not.toContain('cookies')
    expect(manifest.host_permissions).not.toContain('<all_urls>')
    expect(source).not.toMatch(/chrome\.cookies|document\.cookie|console\.(?:log|info|debug)|webRequest|XMLHttpRequest|\.click\(\)/)
    expect(source).not.toMatch(/chrome\.storage\.local\.set\(\s*\{\s*(?:rawText|message|body)\s*:/)
    expect(source.match(/chrome\.storage\.local\.set\(\s*\{[^}]+\}\s*\)/g)).toEqual([
      'chrome.storage.local.set({ lastSyncAt: new Date().toISOString() })',
      'chrome.storage.local.set({ autoSyncEnabled: message.enabled === true })'
    ])
  })

  it('normalizes opt-in auto-sync and deduplicates content only in memory', () => {
    expect(normalizeAutoSyncPreference(true)).toBe(true)
    expect(normalizeAutoSyncPreference('true')).toBe(false)
    const deduper = createMemoryDeduper()
    expect(deduper.has('message-hash')).toBe(false)
    deduper.add('message-hash')
    expect(deduper.has('message-hash')).toBe(true)
    expect(deduper.size()).toBe(1)
  })

  it('handles duplicate server responses without treating them as new', () => {
    expect(summarizeBatchItem({ id: 'mail-1', duplicate: true })).toEqual({ duplicate: true, created: false })
    expect(summarizeBatchItem({ id: 'mail-2', duplicate: false })).toEqual({ duplicate: false, created: true })
  })

  it('supports scan cancellation and reading-pane settling', () => {
    const cancellation = createScanCancellation()
    expect(cancellation.isCancelled()).toBe(false)
    cancellation.cancel()
    expect(cancellation.isCancelled()).toBe(true)
    expect(readingPaneHasSettled(1000, 1749)).toBe(false)
    expect(readingPaneHasSettled(1000, 1750)).toBe(true)
  })
})
