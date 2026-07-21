import { z } from 'zod'
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_MODES } from '#shared/schemas/opportunities'
import { normalizeAdapterCandidate } from '../normalization'

/**
 * @typedef {object} OpportunityAdapter
 * @property {string} key Stable registry and database key.
 * @property {string} name Public source name.
 * @property {string} slug Stable public-source slug.
 * @property {string} baseUrl Public HTTP(S) origin.
 * @property {(context: { source: object }) => Promise<object[]>} fetchCandidates Returns candidate data only—never HTML, cookies, credentials, files, or OCR payloads.
 */

const htmlMarkup = /<\/?[a-z][^>]*>/i
const safeText = (maximum, label) => z.string().trim().min(1, `${label} is required.`).max(maximum, `${label} is too long.`).refine(value => !htmlMarkup.test(value), `${label} must not contain HTML.`)
const nullableText = (maximum, label) => safeText(maximum, label).nullable().default(null)
const nullableDate = label => z.string().datetime({ offset: true, message: `${label} must be an ISO date and time with an offset.` }).nullable().default(null)
const publicUrl = (label, nullable = false) => {
  const schema = z.url(`${label} must be a valid URL.`).superRefine((value, context) => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) context.addIssue({ code: 'custom', message: `${label} must use HTTP or HTTPS.` })
    if (url.username || url.password) context.addIssue({ code: 'custom', message: `${label} must not contain credentials.` })
  })
  return nullable ? schema.nullable().default(null) : schema
}

export const adapterCandidateSchema = z.object({
  externalId: nullableText(240, 'External ID'),
  title: safeText(180, 'Title'),
  organisation: safeText(180, 'Organisation'),
  category: z.enum(OPPORTUNITY_CATEGORIES),
  description: nullableText(5000, 'Description'),
  sourceUrl: publicUrl('Source URL'),
  applicationUrl: publicUrl('Application URL', true),
  publishedAt: nullableDate('Published date'),
  deadline: nullableDate('Deadline'),
  startAt: nullableDate('Start date'),
  endAt: nullableDate('End date'),
  location: nullableText(240, 'Location'),
  mode: z.enum(OPPORTUNITY_MODES).default('UNKNOWN'),
  commitment: nullableText(500, 'Commitment'),
  eligibilityText: nullableText(3000, 'Eligibility'),
  requirements: nullableText(3000, 'Requirements'),
  benefits: nullableText(3000, 'Benefits'),
  tags: z.array(safeText(40, 'Tag')).max(12, 'Use no more than 12 tags.').default([])
}).strict().superRefine((value, context) => {
  if (value.startAt && value.endAt && new Date(value.endAt) < new Date(value.startAt)) {
    context.addIssue({ code: 'custom', path: ['endAt'], message: 'End date cannot be before start date.' })
  }
})

export const normalizedAdapterCandidateSchema = adapterCandidateSchema.transform(normalizeAdapterCandidate)

/** @param {OpportunityAdapter} adapter */
export function defineOpportunityAdapter(adapter) {
  const metadata = z.object({
    key: z.string().regex(/^[a-z0-9-]+$/).max(80),
    name: safeText(180, 'Adapter name'),
    slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
    baseUrl: publicUrl('Base URL'),
    fetchCandidates: z.function()
  }).strict().parse(adapter)
  return Object.freeze(metadata)
}
