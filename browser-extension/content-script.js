(() => {
  let debounceTimer = null
  let lastSignal = ''

  function visible(element) {
    if (!(element instanceof Element) || element.closest('[aria-hidden="true"]')) return false
    const style = getComputedStyle(element)
    const rectangle = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && rectangle.width > 0 && rectangle.height > 0
  }

  function stateSignal() {
    const bodies = [...document.querySelectorAll('[role="document"], [aria-label*="message body" i], [aria-label*="email body" i]')].filter(visible)
    const headings = [...document.querySelectorAll('[role="main"] h1, [role="main"] h2, [role="main"] [role="heading"]')].filter(visible)
    return `${location.pathname}|${bodies.length}|${headings.map(item => item.textContent?.trim().slice(0, 120)).join('|')}`
  }

  function notifyWhenSettled() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const signal = stateSignal()
      if (signal === lastSignal) return
      lastSignal = signal
      chrome.runtime.sendMessage({ type: 'OUTLOOK_STATE_CHANGED' }).catch(() => {})
    }, 900)
  }

  function rowMetadata(row) {
    const subjectNode = row.querySelector('[aria-label*="subject" i], [role="heading"]')
    const senderNode = row.querySelector('[aria-label*="sender" i], [aria-label*="from" i]')
    const timeNode = row.querySelector('time[datetime]')
    const stableId = ['data-message-id', 'data-item-id'].map(name => row.getAttribute(name)).find(Boolean) || null
    return {
      subject: (subjectNode?.textContent || row.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null,
      sender: (senderNode?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) || null,
      receivedAt: timeNode?.getAttribute('datetime') || null,
      stableId
    }
  }

  function discoverVisibleRows() {
    const list = [...document.querySelectorAll('[aria-label*="message list" i], [role="listbox"]')].find(visible)
    if (!list) return { status: 'UNSUPPORTED_OUTLOOK_DOM', visibleCandidates: [] }
    const rows = [...list.querySelectorAll('[role="option"], [role="row"]')].filter(visible).slice(0, 100)
    return {
      status: rows.length ? 'UNSAFE_TO_OPEN_MESSAGES' : 'NO_VISIBLE_MESSAGES',
      reason: rows.length ? 'Opening Outlook rows may change read state, so V2 will not click them automatically.' : null,
      visibleCandidates: rows.map(rowMetadata)
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'DISCOVER_VISIBLE_ROWS') respond(discoverVisibleRows())
  })

  const observer = new MutationObserver(notifyWhenSettled)
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'aria-selected'] })
  notifyWhenSettled()
})()
