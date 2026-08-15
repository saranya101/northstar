# Northstar Mail Chrome Extension V1

Northstar Mail extracts the one email currently open in Outlook Web and sends it to the local Northstar mail-intelligence review pipeline. It does not scan a mailbox, use Microsoft Graph, read cookies, classify mail, or automatically create opportunities or tasks.

## Manual installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `/Users/gavar/projects/northstar/browser-extension`.
5. Pin **Northstar Mail**.
6. Start Northstar with `npm run dev` from `/Users/gavar/projects/northstar`.
7. Sign into Northstar at `http://localhost:3000`.
8. Open NTU Outlook Web.
9. Open **one** email.
10. Click **Northstar Mail**.
11. Click **Extract open email**.
12. Review the detected metadata and optional preview.
13. Click **Send to Northstar**.
14. Open the Northstar Inbox to review the classification.

This is an unpacked local-development extension. It is not distributed through the Chrome Web Store.

## Supported scope

- Outlook Web pages on `outlook.office.com`, `outlook.office365.com`, and `outlook.cloud.microsoft`, under `/mail` or `/owa`.
- One visible reading-pane message at a time.
- Local Northstar at `http://localhost:3000`.
- Existing Northstar browser session, sent by `fetch` with `credentials: "include"`.

The extension requests `activeTab`, `scripting`, and `storage`, plus host access only to `http://localhost:3000/*`. It does not request cookie access or persistent Outlook host access. Chrome storage contains only the last successful connection timestamp; email content and credentials are never stored.

If Northstar returns 401, open Northstar and sign in. If Chrome cannot share the existing session in the installed environment, do not add cookie permission; the follow-up design should use a short-lived Northstar extension pairing token.

## Safe diagnostics

Outlook's DOM can change. Expand **Safe extractor diagnostics** in the popup and run it while one email is open. It reports only:

- whether the Outlook host was recognised;
- reading-pane and body candidate counts;
- candidate tag names, roles, and truncated ARIA labels;
- heading counts, body character lengths, and selector scores.

Diagnostics never include email body text, cookies, storage, tokens, or request headers. The initial selectors are intentionally conservative and must be verified against the real NTU Outlook DOM before they can be considered confirmed.
