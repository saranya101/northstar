import { extractOpportunityFromText, parseOpportunityDateFragment } from './opportunity-text-parser'
import { interpretAcademicMail, withoutAcademicBoilerplate } from './academic-mail-interpreter'

const HEADER = /^(from|sender|subject|sent|date|to|cc):\s*/i
const MODULE_CODE = /\b[A-Z]{2,4}\d{4}\b/
const ACTION_REQUIRED = /\b(action required|mandatory|required action|you (?:are required to|must)|shortlisted candidates are required to|must complete|complete (?:the )?form|complete (?:a |the )?(?:case )?assessment|submit (?:the |your )?(?:form|declaration|assessment|completed assessment)|submit(?:\s+[^.]{0,80})?\s+by|complete(?:\s+[^.]{0,80})?\s+by|respond by|please (?:complete|submit)|interview invitation|assessment invitation|registration action)\b/i
const OPPORTUNITY = /\b(recruit(?:ment|ing)?|internship|career programme|hackathon|competition|challenge|scholarship|exchange programme|gem (?:explorer|discoverer|programme)|mentor(?:ship|ing)?|volunteer(?:ing)?|leadership programme|applications? (?:are )?open|call for applications)\b/i
const ACADEMIC = /\b(venue change|class venue|lecture|tutorial|seminar|module announcement|assessment|quiz|exam(?:ination)?|teaching update|lesson|course registration|add\/drop)\b/i
const EVENT = /\b(networking (?:session|event)|employer event|workshop|webinar|talk|information session|info session|career fair|fireside chat)\b/i
const NOISE = /\b(newsletter|weekly digest|monthly digest|unsubscribe|general publicity|promotional update)\b/i
const DEADLINE_LINE = /\b(deadline|close[sd]?|apply by|submit(?:\s+[^.]{0,80})?\s+by|complete(?:\s+[^.]{0,80})?\s+by|respond by|due|week\s*\d+)\b/i
const ACTION_LINE = /\b(action required|must|required|complete|submit|respond|register|apply)\b/i

const clean = value => value?.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim() || null
const lines = value => String(value || '').replace(/\r/g, '').split('\n').map(clean).filter(Boolean)

function parsedHeaders(rawText) {
  const result = {}
  for (const line of lines(rawText).slice(0, 30)) {
    const subject = line.match(/^subject:\s*(.+)$/i)
    if (subject && !result.subject) result.subject = clean(subject[1])
    const from = line.match(/^(?:from|sender):\s*(.+)$/i)
    if (from && !result.senderEmail) {
      const value = clean(from[1])
      result.senderEmail = clean(value?.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || value?.match(/\b[^\s<>]+@[^\s<>]+\b/)?.[0])
      result.senderName = clean(value?.replace(/<[^<>]+>|\b[^\s<>]+@[^\s<>]+\b/, ''))
      if (result.senderName === result.senderEmail) result.senderName = null
    }
    const received = line.match(/^(?:sent|date):\s*(.+)$/i)
    if (received && !result.receivedAt) result.receivedAt = parseOpportunityDateFragment(received[1])
  }
  return result
}

function confidence(classification, signalCount) {
  if (classification === 'UNCERTAIN') return 'LOW'
  if (signalCount >= 2) return 'HIGH'
  return 'MEDIUM'
}

export function classifyMailText(rawText, metadata = {}) {
  const text = `${metadata.subject || ''}\n${withoutAcademicBoilerplate(rawText)}`
  const reasons = []
  let classification = 'UNCERTAIN'
  if (ACTION_REQUIRED.test(text)) {
    classification = 'ACTION_REQUIRED'
    reasons.push('Mandatory or required-response language detected')
    if (DEADLINE_LINE.test(text)) reasons.push('A deadline or timing reference is present')
  } else if (OPPORTUNITY.test(text)) {
    classification = 'OPPORTUNITY'
    reasons.push('Recruitment, application, or programme language detected')
    if (DEADLINE_LINE.test(text)) reasons.push('An application timing reference is present')
  } else if (ACADEMIC.test(text) || MODULE_CODE.test(text)) {
    classification = 'ACADEMIC_ADMIN'
    reasons.push(MODULE_CODE.test(text) ? 'An explicit module code is present' : 'Academic teaching or assessment language detected')
    if (/\b(change|update|rescheduled|cancelled|notice)\b/i.test(text)) reasons.push('A concrete academic update is described')
  } else if (EVENT.test(text)) {
    classification = 'EVENT'
    reasons.push('A talk, workshop, or networking event is described')
    if (/\b(date|time|venue|location|register)\b/i.test(text)) reasons.push('Event logistics or registration language is present')
  } else if (NOISE.test(text)) {
    classification = 'NOISE'
    reasons.push('Generic newsletter or publicity language detected')
  } else {
    reasons.push('No category has enough explicit evidence')
  }
  return { category: classification, confidenceBand: confidence(classification, reasons.length), reasons }
}

function plainOpportunity(candidate, subject, rawText) {
  const value = key => candidate[key]?.value ?? null
  const sourceLines = lines(rawText)
  return {
    title: value('title') || subject, organisation: value('organisation'), category: value('category'),
    description: lines(rawText).filter(line => !HEADER.test(line)).join('\n').slice(0, 5000) || null,
    deadline: value('deadline'), deadlineSourceText: lines(rawText).find(line => DEADLINE_LINE.test(line)) || null,
    applicationUrl: value('applicationUrl'), sourceUrl: value('sourceUrl'), startAt: value('startAt'), endAt: value('endAt'),
    location: value('location'), mode: value('mode') || 'UNKNOWN', eligibilityText: value('eligibilityText'),
    requirements: value('requirements'), commitment: clean(sourceLines.find(line => /^commitment\s*[:–-]/i.test(line))?.replace(/^commitment\s*[:–-]\s*/i, '')),
    benefits: value('benefits'), tags: value('tags') || [], actionRequired: sourceLines.find(line => ACTION_LINE.test(line)) || null
  }
}

export function deterministicMailInterpretation(input) {
  const headers = parsedHeaders(input.rawText)
  const metadata = {
    subject: input.subject || headers.subject || null,
    senderName: input.senderName || headers.senderName || null,
    senderEmail: input.senderEmail || headers.senderEmail || null,
    receivedAt: input.receivedAt || headers.receivedAt || null
  }
  const classification = classifyMailText(input.rawText, metadata)
  const extractionText = metadata.subject ? `Title: ${metadata.subject}\n${input.rawText}` : input.rawText
  const extracted = ['OPPORTUNITY', 'EVENT'].includes(classification.category) ? extractOpportunityFromText(extractionText) : null
  const payload = {
    opportunity: extracted ? plainOpportunity(extracted.candidate, metadata.subject, input.rawText) : null,
    admin: ['ACTION_REQUIRED', 'ACADEMIC_ADMIN'].includes(classification.category) ? interpretAcademicMail(input.rawText, metadata) : null,
    unresolved: extracted ? extracted.warnings.concat(extracted.candidate.deadline.warnings) : []
  }
  return { metadata, classification, extractedPayload: payload }
}

export function createMailInterpreter() {
  return { key: 'ntu-mail-deterministic-v4', interpret: async input => deterministicMailInterpretation(input) }
}
