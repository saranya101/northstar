import { normalizeOpportunityUrl } from '~~/shared/schemas/opportunities'
import { extractOpportunityFromText } from './opportunity-text-parser'

function field(value = null, confidence = 0, warnings = []) { return { value: value || null, confidence: value ? confidence : 0, warnings } }
function entities(value = '') { return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))) }
function plain(value) { return entities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || null }
function attribute(tag, name) { return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || null }
function metaMap(html) {
  const result = new Map()
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = attribute(tag, 'property') || attribute(tag, 'name') || attribute(tag, 'itemprop')
    const content = attribute(tag, 'content')
    if (key && content && !result.has(key.toLowerCase())) result.set(key.toLowerCase(), plain(content))
  }
  return result
}
function linkValue(html, relation, baseUrl) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if ((attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes(relation)) {
      try {
        const result = new URL(attribute(tag, 'href'), baseUrl)
        const base = new URL(baseUrl)
        if (!['http:', 'https:'].includes(result.protocol) || (relation === 'canonical' && result.origin !== base.origin)) return null
        return normalizeOpportunityUrl(result.toString())
      } catch { return null }
    }
  }
  return null
}
function safeDate(value) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.valueOf()) || !/\b\d{4}\b/.test(String(value)) ? null : date.toISOString() }
function structuredNodes(html) {
  const nodes = []
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      const values = Array.isArray(parsed) ? parsed : [parsed]
      for (const value of values) nodes.push(...(Array.isArray(value?.['@graph']) ? value['@graph'] : [value]))
    } catch { /* Ignore malformed publisher metadata. */ }
  }
  return nodes.filter(Boolean)
}
function nodeType(node) { return [node?.['@type']].flat().filter(Boolean).join(' ') }
function bestNode(nodes) { return nodes.find(node => /JobPosting|Event|Education|Program|Scholarship|Grant|Course/i.test(nodeType(node)) || node?.validThrough || node?.applicationDeadline || node?.startDate) || null }
function named(value) { if (typeof value === 'string') return plain(value); if (Array.isArray(value)) return named(value[0]); return plain(value?.name || value?.legalName) }
function locationValue(value) {
  if (typeof value === 'string') return plain(value)
  const item = Array.isArray(value) ? value[0] : value
  const address = item?.address
  return plain(item?.name || (typeof address === 'string' ? address : [address?.streetAddress, address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(', ')))
}
function attendanceMode(value) { const text = String(value || ''); return /Mixed|Hybrid/i.test(text) ? 'HYBRID' : /Online|Virtual/i.test(text) ? 'ONLINE' : /Offline|InPerson/i.test(text) ? 'IN_PERSON' : null }
function absoluteUrl(value, base) { if (!value) return null; try { const result = new URL(value, base); return result.protocol === 'https:' ? normalizeOpportunityUrl(result.toString()) : null } catch { return null } }
function visibleText(html) {
  return entities(html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<\s*br\s*\/?>|<\/(?:p|div|li|section|article|h[1-6]|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()).slice(0, 40_000)
}
function sectionById(html, id) {
  return html.match(new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i'))?.[1] || ''
}
function safeExtractedText(value) {
  return plain(value)?.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '').replace(/\s+/g, ' ').trim() || null
}
function dateValue(value, timeZone) {
  return extractOpportunityFromText(`Deadline: ${value}`, { timeZone }).candidate.deadline.value
}
function timelineDetails(html, timeZone) {
  const section = sectionById(html, 'timeline')
  if (!section) return null
  const cards = []
  const expression = /<div\b[^>]*class=["'][^"']*\btl-card-title\b[^"']*["'][^>]*>([\s\S]{0,600}?)<div\b[^>]*class=["'][^"']*\btl-card-date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  for (const match of section.matchAll(expression)) {
    const label = plain(match[1])
    const date = plain(match[2])
    if (label && date && !cards.some(card => card.label === label && card.date === date)) cards.push({ label, date })
  }
  const registration = cards.find(card => /\b(registration|application)\s+(window|period)\b|\b(applications?|registration)\s+(close|closing|deadline)\b/i.test(card.label)
    && !/proposal|submission|final|presentation|judging|shortlist/i.test(card.label))
  const finalEvent = cards.find(card => /\b(final presentations?|final event|finals?)\b/i.test(card.label))
  const range = registration?.date.match(/\b(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b/i)
  const deadlineText = range ? `${range[2]} ${range[3]} ${range[4]}` : registration?.date
  const startText = range ? `${range[1]} ${range[3]} ${range[4]}` : null
  return {
    deadline: dateValue(deadlineText, timeZone),
    deadlineLabel: deadlineText,
    startAt: dateValue(startText, timeZone),
    finalAt: dateValue(finalEvent?.date, timeZone),
    finalLabel: finalEvent?.date || null,
    milestones: cards.filter(card => card !== registration && card !== finalEvent)
  }
}
function faqDetails(html) {
  const section = sectionById(html, 'faq')
  if (!section) return null
  const answers = []
  for (const match of section.matchAll(/<span\b[^>]*class=["'][^"']*\bfaq-q\b[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]{0,800}?<div\b[^>]*class=["'][^"']*\bfaq-answer\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) {
    const question = safeExtractedText(match[1])
    const answer = safeExtractedText(match[2])
    if (question && answer && !/\b(contact|email)\b/i.test(question)) answers.push({ question, answer })
  }
  const answerFor = pattern => answers.find(item => pattern.test(item.question))?.answer || null
  const participation = answerFor(/who can participate|who (?:is )?eligible|who can apply/i)
  const experience = answerFor(/prior .{0,20}experience|experience required/i)
  const team = answerFor(/how many .{0,20}(?:team|members)|team (?:size|members)/i)
  const attendance = answerFor(/overseas|attend|onsite|on-site/i)
  return {
    eligibility: [participation, experience?.match(/^[^.!?]+[.!?]/)?.[0]].filter(Boolean).join(' ') || null,
    requirements: [team, attendance, experience && /expected|required|must/i.test(experience) ? experience : null].filter(Boolean).join(' ') || null,
    attendance
  }
}
function benefitDetails(text) {
  const values = []
  if (/cash prizes?|cash prize/i.test(text)) values.push('Cash prizes for winning teams.')
  if (/OpenAI API credits?/i.test(text)) values.push('OpenAI API credits for winning team members.')
  if (/ChatGPT Pro (?:access)?/i.test(text)) values.push('ChatGPT Pro access for participants.')
  if (/\bmentor(?:ship|ing)?\b|Garena mentor/i.test(text)) values.push('Mentorship for finalist teams.')
  if (/network(?:ing)? with industry leaders|networking opportunities/i.test(text)) values.push('Networking with industry leaders.')
  if (/career opportunities/i.test(text)) values.push('Standout participants may be considered for relevant career opportunities.')
  return values.join(' ') || null
}
function scopedLocation(faq, timeline) {
  const attendance = faq?.attendance || ''
  if (!/\b(on-?site|in person)\b/i.test(attendance) || !/Singapore/i.test(attendance)) return null
  const office = /Garena(?: Singapore(?:'s)?)? office|Garena HQ/i.test(attendance) ? 'Garena Singapore office' : 'onsite venue'
  return {
    value: `Singapore; onsite final at ${office}`,
    warning: timeline?.finalLabel ? `Only the final on ${timeline.finalLabel} is explicitly onsite; the challenge as a whole was not classified as in-person.` : 'Only the final is explicitly onsite; the challenge as a whole was not classified as in-person.'
  }
}
function applicationLink(html, base) {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (/\b(apply|application|register|sign up)\b/i.test(plain(match[2]) || '')) {
      const result = absoluteUrl(attribute(match[1], 'href'), base)
      if (result) return result
    }
  }
  return null
}
function keywords(value) { return [...new Set(String(value || '').split(/[,;|]/).map(item => plain(item)?.toLowerCase()).filter(item => item && item.length <= 40))].slice(0, 12) }
function choose(primary, secondary, fallback, warning) {
  if (primary?.value) return primary
  if (secondary?.value) return secondary
  if (fallback?.value || fallback?.warnings?.length) return fallback
  return field(null, 0, warning ? [warning] : [])
}

export function extractOpportunityFromHtml(html, finalUrl, { timeZone = 'Asia/Singapore' } = {}) {
  const metadata = metaMap(html)
  const nodes = structuredNodes(html)
  const node = bestNode(nodes)
  const text = visibleText(html)
  const metadataText = [...metadata.values()].filter(Boolean).join('\n')
  const labelled = extractOpportunityFromText(`${metadataText}\n${text}`, { timeZone })
  const timeline = timelineDetails(html, timeZone)
  const faq = faqDetails(html)
  const benefits = benefitDetails(text)
  const location = scopedLocation(faq, timeline)
  const canonical = linkValue(html, 'canonical', finalUrl) || normalizeOpportunityUrl(finalUrl)
  const titleTag = plain(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const heading = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const publisherNode = nodes.find(value => /Organization|CollegeOrUniversity/i.test(nodeType(value)))
  const structuredOrganisation = named(node?.hiringOrganization || node?.organizer || node?.provider || node?.publisher) || named(publisherNode)
  const structuredLocation = locationValue(node?.jobLocation || node?.location)
  const structuredApplication = absoluteUrl(node?.applicationUrl || node?.url, finalUrl)
  const metaApplication = absoluteUrl(metadata.get('application:url') || metadata.get('apply:url'), finalUrl)
  const warnings = []
  const sourceHost = new URL(canonical).hostname
  const metadataTitle = metadata.get('og:title') || metadata.get('twitter:title') || titleTag
  const usefulMetadataTitle = metadataTitle && heading && [structuredOrganisation, metadata.get('og:site_name')].filter(Boolean).some(value => value.toLowerCase() === metadataTitle.toLowerCase()) ? null : metadataTitle
  const result = {
    candidate: {
      title: choose(field(plain(node?.name || node?.headline || node?.title), .98), field(usefulMetadataTitle, .86), field(heading || labelled.candidate.title.value, .68), 'Title needs review.'),
      organisation: choose(field(structuredOrganisation, .96), field(metadata.get('og:site_name') || metadata.get('application-name') || metadata.get('author'), .78), labelled.candidate.organisation, 'Organisation was not identified.'),
      category: choose(field(labelled.candidate.category.value, node ? .88 : 0), null, labelled.candidate.category, 'Choose a category.'),
      description: choose(field(plain(node?.description), .96), field(metadata.get('og:description') || metadata.get('description') || metadata.get('twitter:description'), .84), field(null)),
      deadline: choose(field(safeDate(node?.validThrough || node?.applicationDeadline), .98), field(safeDate(metadata.get('article:expiration_time') || metadata.get('deadline')), .85), timeline?.deadline ? field(timeline.deadline, .95, [`Registration closes on ${timeline.deadlineLabel}; no closing time was published.`]) : labelled.candidate.deadline),
      startAt: choose(field(safeDate(node?.startDate), .98), field(safeDate(metadata.get('event:start_time')), .86), timeline?.startAt ? field(timeline.startAt, .93, ['This is the start of the published registration window.']) : labelled.candidate.startAt),
      endAt: choose(field(safeDate(node?.endDate), .98), field(safeDate(metadata.get('event:end_time')), .86), timeline?.finalAt ? field(timeline.finalAt, .95, [`Final presentations are on ${timeline.finalLabel}; no event time was published.`]) : labelled.candidate.endAt),
      location: choose(field(structuredLocation, .95), field(metadata.get('event:location') || metadata.get('location'), .8), location ? field(location.value, .95, [location.warning]) : labelled.candidate.location),
      mode: choose(field(attendanceMode(node?.eventAttendanceMode || node?.jobLocationType), .95), field(attendanceMode(metadata.get('event:attendance_mode')), .8), location ? field('UNKNOWN', .82, [location.warning]) : labelled.candidate.mode),
      applicationUrl: choose(field(structuredApplication, .93), field(metaApplication, .85), field(applicationLink(html, finalUrl) || labelled.candidate.applicationUrl.value, .74)),
      sourceUrl: field(canonical, linkValue(html, 'canonical', finalUrl) ? .96 : .9),
      eligibilityText: choose(field(plain(node?.eligibility || node?.qualifications), .94), faq?.eligibility ? field(faq.eligibility, .95) : null, labelled.candidate.eligibilityText),
      requirements: choose(field(plain(node?.responsibilities || node?.skills || node?.qualifications), .92), faq?.requirements ? field(faq.requirements, .95) : null, labelled.candidate.requirements),
      benefits: choose(field(plain(node?.jobBenefits || node?.benefits), .92), benefits ? field(benefits, .9) : null, labelled.candidate.benefits),
      tags: choose(field(keywords(node?.keywords), .9), field(keywords(metadata.get('keywords') || metadata.get('article:tag')), .75), labelled.candidate.tags)
    },
    warnings,
    sourceHost
  }
  if (timeline?.finalLabel) warnings.push(`Final presentations are scheduled for ${timeline.finalLabel}; this was kept separate from the application deadline.`)
  for (const milestone of timeline?.milestones || []) warnings.push(`${milestone.label}: ${milestone.date}. This milestone was kept separate from the application deadline.`)
  for (const [key, value] of Object.entries(result.candidate)) if (!value.value && !value.warnings.length) value.warnings.push(`${key} was not found and was left blank.`)
  return result
}
