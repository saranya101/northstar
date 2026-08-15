# Northstar Mail Automation V2

Northstar Mail ingests individual Outlook Web messages into the local Northstar review pipeline while Outlook is open. Northstar remains responsible for classification, extraction, persistent deduplication, review, and user-confirmed Opportunity or Task creation.

The extension does not use Microsoft Graph or OAuth, read cookies, download attachments, classify messages, call third parties, or modify Outlook mail.

## Install or reload

1. Start Northstar with `npm run dev` in `/Users/gavar/projects/northstar`.
2. Sign into `http://localhost:3000`.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. For a first install, click **Load unpacked** and select `/Users/gavar/projects/northstar/browser-extension`.
6. For an existing V1 install, click **Reload** on the Northstar Mail extension card so the V2 manifest, service worker, and content script are active.
7. Review the new requested site access. It is limited to localhost, `outlook.office.com`, and `outlook.office365.com`.
8. Pin **Northstar Mail**.
9. Open NTU Outlook Web and refresh the Outlook tab once after reloading the extension.
10. Open one email and use **Extract open email**, or explicitly enable **Auto-sync while Outlook is open**.
11. Open Northstar Inbox to review the resulting MailIntake. No Opportunity or Task is created automatically.

## Auto-sync

Auto-sync defaults to off. When enabled, a debounced content script observes meaningful Outlook DOM changes. The service worker runs the fail-closed semantic extractor after the reading pane settles, hashes the structured message in memory to suppress SPA rerenders, and posts the already-separated message to `/api/mail-intake/batch`. Only `autoSyncEnabled` and `lastSyncAt` are stored; raw mail is never written to extension storage.

## Scan new emails safety boundary

**Scan new emails** conservatively discovers visible rows in the current Outlook message list and reports the candidate count. V2 does not click those rows: Outlook may mark a message read when opened, and that mailbox-state mutation cannot be ruled out through the unstable DOM. The scan therefore fails closed before sequential extraction. It does not scan hidden folders, infer messages from preview text, or navigate the mailbox.

## Permissions

- `activeTab`, `scripting`, and `storage`.
- `http://localhost:3000/*` for the authenticated Northstar batch request.
- `https://outlook.office.com/*` and `https://outlook.office365.com/*` for the persistent content script while Outlook is open.

There is no `<all_urls>`, `cookies`, `webRequest`, `identity`, `history`, or `browsingData` permission. If the tested NTU Outlook host differs, add that exact host only after confirming it.

## Safe diagnostics

The popup diagnostic reports reading-pane/body candidate counts, tag names, roles, truncated ARIA labels, heading counts, character lengths, and scores. It never reports body text, cookies, tokens, request headers, or stored credentials. Outlook selectors and authentication still require verification against the real NTU environment.
