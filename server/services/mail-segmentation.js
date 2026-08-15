const HEADER = /^(from|sender|sent|date|to|cc|subject):\s*(.*)$/i
const FROM = /^(from|sender):\s*/i
const SUBJECT = /^subject:\s*/i
const SENDER_LINE = /(?:\bon behalf of\b|<[^<>\s]+@[^<>\s]+>|\b[^\s<>]+@[^\s<>]+\b)/i
const FORWARDED = /^(?:-{2,}\s*)?(?:original message|forwarded message|begin forwarded message)(?:\s*-{2,})?\s*:?-*$/i
const SEPARATOR = /^[-_=]{5,}\s*$/

const normalize = value => String(value || '').replace(/\r\n?/g, '\n').trim()

function headerEvidence(lines, start) {
  const kinds = new Set()
  for (let index = start; index < Math.min(lines.length, start + 9); index += 1) {
    const match = lines[index].trim().match(HEADER)
    if (match) kinds.add(match[1].toLowerCase())
    else if (lines[index].trim() && index > start + 1) break
  }
  return kinds
}

function nearbyMessageTransition(lines, index) {
  const before = lines.slice(Math.max(0, index - 8), index).join('\n')
  const after = lines.slice(index, Math.min(lines.length, index + 8)).join('\n')
  const closed = /(?:regards|sincerely|thank you|best wishes|warm regards)[,\s]*\n[^\n]*$/i.test(before.trim())
  const greeting = /(?:^|\n)\s*(?:dear|hello|hi)\b/i.test(after)
  return closed || greeting
}

/**
 * Conservatively proposes email boundaries in a plain-text paste. This function
 * is pure: it neither interprets nor persists any message.
 */
export function splitPastedEmails(rawText) {
  const source = normalize(rawText)
  if (!source) return { segments: [], ambiguous: false, warning: null }

  const lines = source.split('\n')
  const candidates = new Map()
  const add = (index, confidence, signals) => {
    if (index <= 0 || index >= lines.length) return
    const previous = candidates.get(index)
    if (!previous || previous.confidence === 'MEDIUM' && confidence === 'HIGH') candidates.set(index, { index, confidence, signals })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (FROM.test(line)) {
      const evidence = headerEvidence(lines, index)
      const supporting = ['sent', 'date', 'to', 'subject'].filter(kind => evidence.has(kind))
      if (supporting.length >= 2) add(index, 'HIGH', ['repeated sender/header block', ...supporting.map(kind => `${kind} header`)])
      else if (supporting.length || nearbyMessageTransition(lines, index)) add(index, 'MEDIUM', ['possible sender transition'])
    }

    if (!HEADER.test(line) && SENDER_LINE.test(line)) {
      const evidence = headerEvidence(lines, index)
      const supporting = ['sent', 'date', 'to', 'subject'].filter(kind => evidence.has(kind))
      if (supporting.length >= 2) add(index, 'HIGH', [line.match(/on behalf of/i) ? 'on-behalf-of sender line' : 'sender identity line', ...supporting.map(kind => `${kind} header`)])
    }

    if (FORWARDED.test(line)) {
      const nextHeader = lines.slice(index + 1, index + 7).findIndex(value => HEADER.test(value.trim()))
      if (nextHeader >= 0) add(index, 'HIGH', ['forwarded/original-message separator', 'following mail headers'])
    }

    if (SUBJECT.test(line) && index > 0) {
      const evidence = headerEvidence(lines, Math.max(0, index - 4))
      const hasEnvelope = ['from', 'sender', 'sent', 'date', 'to'].some(kind => evidence.has(kind))
      if (!hasEnvelope && nearbyMessageTransition(lines, index)) add(index, 'MEDIUM', ['subject heading', 'message transition'])
      else if (lines[index - 1] && SEPARATOR.test(lines[index - 1].trim())) add(index - 1, 'MEDIUM', ['separator', 'subject heading'])
    }
  }

  const boundaries = [...candidates.values()].sort((left, right) => left.index - right.index).filter((item, index, all) => {
    const previous = all[index - 1]
    return !(previous && item.index - previous.index <= 6 && previous.signals.includes('forwarded/original-message separator'))
  })
  const strong = boundaries.filter(item => item.confidence === 'HIGH')
  const selected = boundaries
  const starts = [0, ...selected.map(item => item.index)]
  const segments = starts.map((start, position) => {
    const end = starts[position + 1] ?? lines.length
    const raw = lines.slice(start, end).join('\n').trim()
    const boundary = position ? selected[position - 1] : null
    return {
      rawText: raw,
      boundaryConfidence: boundary?.confidence || 'HIGH',
      boundarySignals: boundary?.signals || ['start of paste']
    }
  }).filter(segment => segment.rawText)

  const headerCounts = lines.reduce((counts, line) => {
    const match = line.trim().match(HEADER)
    if (match) counts[match[1].toLowerCase()] = (counts[match[1].toLowerCase()] || 0) + 1
    return counts
  }, {})
  const repeatedHints = Math.max(headerCounts.from || 0, headerCounts.sender || 0, headerCounts.subject || 0, headerCounts.sent || 0) > 1
  const ambiguous = selected.some(item => item.confidence === 'MEDIUM') || (!strong.length && repeatedHints)

  return {
    segments,
    ambiguous,
    warning: ambiguous ? 'Multiple emails may be present' : null
  }
}
