import { createHash } from 'node:crypto'

const trackingParameters = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid'])

export function normalizeScannerUrl(value) {
  if (!value) return null
  const url = new URL(value.trim())
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
  for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase())) url.searchParams.delete(key)
  url.searchParams.sort()
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString()
}

export function normalizeScannerText(value) {
  if (value === null || value === undefined) return null
  const normalized = value.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean).join('\n').trim()
  return normalized || null
}

export function normalizeScannerTags(tags) {
  const unique = new Map()
  for (const value of tags || []) {
    const tag = normalizeScannerText(value)
    const key = tag?.toLocaleLowerCase()
    if (key && !unique.has(key)) unique.set(key, tag)
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

export function normalizeAdapterCandidate(candidate) {
  const normalized = {
    externalId: normalizeScannerText(candidate.externalId),
    title: normalizeScannerText(candidate.title),
    organisation: normalizeScannerText(candidate.organisation),
    category: candidate.category,
    description: normalizeScannerText(candidate.description),
    sourceUrl: normalizeScannerUrl(candidate.sourceUrl),
    applicationUrl: normalizeScannerUrl(candidate.applicationUrl),
    publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
    deadline: candidate.deadline ? new Date(candidate.deadline) : null,
    startAt: candidate.startAt ? new Date(candidate.startAt) : null,
    endAt: candidate.endAt ? new Date(candidate.endAt) : null,
    location: normalizeScannerText(candidate.location),
    mode: candidate.mode,
    eligibilityText: normalizeScannerText(candidate.eligibilityText),
    requirements: normalizeScannerText(candidate.requirements),
    benefits: normalizeScannerText(candidate.benefits),
    tags: normalizeScannerTags(candidate.tags)
  }
  return normalized
}

export function candidateContentHash(candidate) {
  const serializable = Object.fromEntries(Object.entries(candidate).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]))
  return createHash('sha256').update(JSON.stringify(serializable)).digest('hex')
}

export function duplicateFingerprint(candidate) {
  const text = value => normalizeScannerText(value)?.toLocaleLowerCase().normalize('NFKC') || ''
  const deadline = candidate.deadline ? new Date(candidate.deadline).toISOString() : ''
  return createHash('sha256').update(`${text(candidate.title)}\u0000${text(candidate.organisation)}\u0000${deadline}`).digest('hex')
}

