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
      deadline: choose(field(safeDate(node?.validThrough || node?.applicationDeadline), .98), field(safeDate(metadata.get('article:expiration_time') || metadata.get('deadline')), .85), labelled.candidate.deadline),
      startAt: choose(field(safeDate(node?.startDate), .98), field(safeDate(metadata.get('event:start_time')), .86), labelled.candidate.startAt),
      endAt: choose(field(safeDate(node?.endDate), .98), field(safeDate(metadata.get('event:end_time')), .86), labelled.candidate.endAt),
      location: choose(field(structuredLocation, .95), field(metadata.get('event:location') || metadata.get('location'), .8), labelled.candidate.location),
      mode: choose(field(attendanceMode(node?.eventAttendanceMode || node?.jobLocationType), .95), field(attendanceMode(metadata.get('event:attendance_mode')), .8), labelled.candidate.mode),
      applicationUrl: choose(field(structuredApplication, .93), field(metaApplication, .85), field(applicationLink(html, finalUrl) || labelled.candidate.applicationUrl.value, .74)),
      sourceUrl: field(canonical, linkValue(html, 'canonical', finalUrl) ? .96 : .9),
      eligibilityText: choose(field(plain(node?.eligibility || node?.qualifications), .94), null, labelled.candidate.eligibilityText),
      requirements: choose(field(plain(node?.responsibilities || node?.skills || node?.qualifications), .92), null, labelled.candidate.requirements),
      benefits: choose(field(plain(node?.jobBenefits || node?.benefits), .92), null, labelled.candidate.benefits),
      tags: choose(field(keywords(node?.keywords), .9), field(keywords(metadata.get('keywords') || metadata.get('article:tag')), .75), labelled.candidate.tags)
    },
    warnings,
    sourceHost
  }
  for (const [key, value] of Object.entries(result.candidate)) if (!value.value && !value.warnings.length) value.warnings.push(`${key} was not found and was left blank.`)
  return result
}
