export function extractOpenOutlookMessage(options = {}) {
  const diagnosticMode = options?.diagnostic === true
  const outlookHosts = new Set(['outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft'])
  const recognisedHost = location.protocol === 'https:' && outlookHosts.has(location.hostname.toLowerCase()) && /^\/(?:mail|owa)(?:\/|$)/i.test(location.pathname)
  if (!recognisedHost) return { status: 'UNSUPPORTED_OUTLOOK_HOST' }

  const normalize = value => String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
  const compact = value => String(value || '').replace(/\s+/g, ' ').trim()
  const visible = element => {
    if (!(element instanceof Element) || element.closest('[aria-hidden="true"]')) return false
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const rectangle = element.getBoundingClientRect()
    return rectangle.width > 0 && rectangle.height > 0
  }
  const descriptor = element => ({
    tagName: element.tagName.toLowerCase(),
    role: element.getAttribute('role') || null,
    ariaLabel: compact(element.getAttribute('aria-label')).slice(0, 160) || null
  })

  const readingPanes = [...document.querySelectorAll('[aria-label*="reading pane" i], [role="main"]')].filter(visible)
  const roots = readingPanes.length ? readingPanes : []
  const bodySelectors = ['[role="document"]', '[aria-label*="message body" i]', '[aria-label*="email body" i]']
  const candidates = []
  const seenNodes = new Set()
  for (const root of roots) {
    for (const selector of bodySelectors) {
      const nodes = [...root.querySelectorAll(selector)]
      if (root.matches(selector)) nodes.unshift(root)
      for (const node of nodes) {
        if (seenNodes.has(node) || !visible(node)) continue
        seenNodes.add(node)
        const text = normalize(node.innerText || node.textContent)
        if (text.length < 20 || text.length > 50_000) continue
        let score = 0
        if (node.getAttribute('role') === 'document') score += 6
        if (/message body|email body/i.test(node.getAttribute('aria-label') || '')) score += 6
        if (node.closest('[aria-label*="reading pane" i]')) score += 4
        if (text.length >= 80) score += 2
        candidates.push({ node, root, text, score })
      }
    }
  }

  const distinct = []
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    const duplicate = distinct.some(existing => existing.text === candidate.text)
    if (!duplicate) distinct.push(candidate)
  }
  const plausible = distinct.filter(candidate => candidate.score >= 6)
  const diagnostic = {
    recognisedOutlookHost: true,
    readingPaneCandidates: readingPanes.length,
    messageBodyCandidates: plausible.length,
    candidates: plausible.slice(0, 10).map(candidate => ({
      ...descriptor(candidate.node),
      headingCount: candidate.root.querySelectorAll('h1, h2, h3, [role="heading"]').length,
      bodyCharacterLength: candidate.text.length,
      score: candidate.score
    }))
  }
  if (diagnosticMode) return { status: 'DIAGNOSTIC', diagnostic }
  if (!roots.length) return { status: 'UNSUPPORTED_OUTLOOK_DOM', diagnostic }
  if (!plausible.length) return { status: 'NO_OPEN_MESSAGE', diagnostic }
  if (plausible.length !== 1) return { status: 'AMBIGUOUS_MESSAGE', diagnostic }

  const selected = plausible[0]
  const boundary = selected.node.closest('[aria-label*="reading pane" i]') || selected.root
  const beforeBody = element => Boolean(element.compareDocumentPosition(selected.node) & Node.DOCUMENT_POSITION_FOLLOWING)
  const metadataNodes = [...boundary.querySelectorAll('h1, h2, h3, [role="heading"], [aria-label], a[href^="mailto:"], time[datetime]')]
    .filter(element => visible(element) && !selected.node.contains(element))

  const headingCandidates = metadataNodes.filter(element => element.matches('h1, h2, h3, [role="heading"]') && beforeBody(element)).map(element => ({
    text: compact(element.innerText || element.textContent || element.getAttribute('aria-label')),
    score: (/subject/i.test(element.getAttribute('aria-label') || '') ? 5 : 0) + (/^H[12]$/.test(element.tagName) ? 2 : 0)
  })).filter(item => item.text && item.text.length <= 300).sort((left, right) => right.score - left.score)
  const subject = headingCandidates[0]?.text || null

  const senderCandidates = metadataNodes.filter(element => beforeBody(element) && (
    element.matches('a[href^="mailto:"]') || /(?:^|\b)(?:from|sender)(?:\b|:)/i.test(element.getAttribute('aria-label') || '')
  ))
  let senderName = null
  let senderEmail = null
  for (const element of senderCandidates) {
    const source = compact(`${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.textContent || ''} ${element.getAttribute('href') || ''}`)
    const email = source.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || null
    const name = compact(source.replace(/^mailto:/i, '').replace(email || '', '').replace(/^(?:from|sender)\s*:?\s*/i, '').replace(/[<>]/g, '')) || null
    if (!senderEmail && email) senderEmail = email.toLowerCase()
    if (!senderName && name && name !== senderEmail) senderName = name.slice(0, 240)
    if (senderEmail && senderName) break
  }

  let receivedAt = null
  const time = metadataNodes.find(element => element.matches('time[datetime]') && beforeBody(element))
  if (time) {
    const parsed = new Date(time.getAttribute('datetime'))
    if (!Number.isNaN(parsed.getTime())) receivedAt = parsed.toISOString()
  }

  const links = []
  const seenLinks = new Set()
  for (const anchor of selected.node.querySelectorAll('a[href]')) {
    if (!visible(anchor)) continue
    try {
      const url = new URL(anchor.href)
      if (!['http:', 'https:'].includes(url.protocol) || seenLinks.has(url.href)) continue
      seenLinks.add(url.href)
      links.push({ text: compact(anchor.innerText || anchor.textContent).slice(0, 500), url: url.href.slice(0, 2000) })
    } catch {}
  }

  return {
    status: 'OK',
    message: {
      subject,
      senderName,
      senderEmail,
      receivedAt,
      rawText: selected.text,
      links
    }
  }
}
