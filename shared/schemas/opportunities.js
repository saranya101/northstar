import { z } from 'zod'

export const OPPORTUNITY_CATEGORIES = ['INTERNSHIP', 'PART_TIME_JOB', 'GRADUATE_PROGRAMME', 'HACKATHON', 'COMPETITION', 'VOLUNTEERING', 'CLUB', 'LEADERSHIP', 'SCHOLARSHIP', 'GRANT', 'RESEARCH', 'EXCHANGE', 'SUMMER_PROGRAMME', 'MENTORSHIP', 'ENTREPRENEURSHIP', 'WORKSHOP', 'TALK', 'NETWORKING', 'CERTIFICATION', 'AMBASSADOR', 'PROJECT', 'OTHER']
export const OPPORTUNITY_SOURCE_TYPES = ['MANUAL', 'PASTED_TEXT', 'PASTED_LINK', 'PUBLIC_SOURCE', 'EMAIL']
export const OPPORTUNITY_MODES = ['IN_PERSON', 'ONLINE', 'HYBRID', 'UNKNOWN']
export const USER_OPPORTUNITY_STATUSES = ['SAVED', 'INTERESTED', 'APPLYING', 'APPLIED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'IGNORED']

const unsafeText = /<\s*script\b|\0/i
const safeString = (maximum, label = 'Text') => z.string().trim().max(maximum, `${label} is too long.`).refine(value => !unsafeText.test(value), `${label} contains unsupported content.`)
const nullableText = (maximum, label) => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  safeString(maximum, label).nullable().optional()
)
const isoDate = label => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().datetime({ offset: true, message: `${label} must be a valid ISO date and time.` }).nullable().optional()
)
export function normalizeOpportunityUrl(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
    return url.toString()
  } catch { return trimmed }
}

const httpsUrl = label => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.url(`${label} must be a valid URL.`).refine(value => value.startsWith('https://'), `${label} must use HTTPS.`).transform(normalizeOpportunityUrl).nullable().optional()
)
const publicWebUrl = label => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.url(`${label} must be a valid URL.`).refine(value => value.startsWith('http://') || value.startsWith('https://'), `${label} must use HTTP or HTTPS.`).transform(normalizeOpportunityUrl).nullable().optional()
)
const tagsSchema = z.preprocess(value => {
  if (typeof value === 'string') value = value.split(',')
  if (!Array.isArray(value)) return value
  const unique = new Map()
  for (const tag of value) {
    const trimmed = String(tag).trim()
    const key = trimmed.toLocaleLowerCase()
    if (key && !unique.has(key)) unique.set(key, trimmed)
  }
  return [...unique.values()]
}, z.array(safeString(40, 'Tag')).max(12, 'Use no more than 12 tags.').default([]))

const opportunityFields = {
  title: safeString(180, 'Title').min(2, 'Title is required.'),
  organisation: safeString(180, 'Organisation').min(2, 'Organisation is required.'),
  category: z.enum(OPPORTUNITY_CATEGORIES, { error: 'Select a valid category.' }),
  description: nullableText(5000, 'Description'),
  sourceType: z.enum(OPPORTUNITY_SOURCE_TYPES).default('MANUAL'),
  sourceName: nullableText(180, 'Source name'),
  sourceUrl: publicWebUrl('Source URL'),
  applicationUrl: httpsUrl('Application URL'),
  publishedAt: isoDate('Published date'),
  deadline: isoDate('Deadline'),
  startAt: isoDate('Start date'),
  endAt: isoDate('End date'),
  location: nullableText(240, 'Location'),
  mode: z.enum(OPPORTUNITY_MODES).default('UNKNOWN'),
  commitment: nullableText(500, 'Commitment'),
  eligibilityText: nullableText(3000, 'Eligibility'),
  requirements: nullableText(3000, 'Requirements'),
  benefits: nullableText(3000, 'Benefits'),
  tags: tagsSchema
}

function datesInOrder(value, context) {
  if (value.startAt && value.endAt && new Date(value.endAt) < new Date(value.startAt)) {
    context.addIssue({ code: 'custom', path: ['endAt'], message: 'End date cannot be before start date.' })
  }
}

export const createOpportunitySchema = z.object({ ...opportunityFields, allowDuplicate: z.boolean().optional().default(false) }).strict().superRefine(datesInOrder)

export const updateOpportunitySchema = z.object(Object.fromEntries(
  Object.entries(opportunityFields).map(([key, schema]) => [key, schema.optional()])
)).strict().superRefine((value, context) => {
  if (!Object.keys(value).length) context.addIssue({ code: 'custom', path: ['_form'], message: 'Provide at least one field to update.' })
  datesInOrder(value, context)
})

const booleanQuery = z.preprocess(value => value === 'true' || value === true ? true : value === 'false' || value === false || value === undefined ? false : value, z.boolean())
const categoryListQuery = z.preprocess(value => {
  if (value === undefined || value === null || value === '') return []
  const values = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item).split(','))
    .map(item => item.trim())
    .filter(Boolean)
  return [...new Set(values)]
}, z.array(z.enum(OPPORTUNITY_CATEGORIES)).max(8, 'Choose no more than eight categories.').default([]))
const optionalTagQuery = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  safeString(40, 'Tag').optional()
)

export const opportunityFiltersSchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  category: z.enum(OPPORTUNITY_CATEGORIES).optional(),
  categories: categoryListQuery.optional().default([]),
  tag: optionalTagQuery,
  mode: z.enum(OPPORTUNITY_MODES).optional(),
  status: z.enum(USER_OPPORTUNITY_STATUSES).optional(),
  closingSoon: booleanQuery.optional().default(false),
  upcoming: booleanQuery.optional().default(false),
  expired: booleanQuery.optional().default(false),
  sort: z.enum(['deadline', 'newest', 'title']).optional().default('deadline'),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20)
}).strict()

export const updateOpportunityStatusSchema = z.object({
  status: z.enum(USER_OPPORTUNITY_STATUSES).optional(),
  personalDeadline: isoDate('Personal deadline'),
  notes: nullableText(5000, 'Notes'),
  savedAt: isoDate('Saved date'),
  appliedAt: isoDate('Applied date')
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Provide at least one personal field to update.' })

export const parseOpportunityTextSchema = z.object({
  text: safeString(20_000, 'Pasted text').min(20, 'Paste at least 20 characters.')
}).strict()

export const parseOpportunityLinkSchema = z.object({
  url: z.preprocess(value => typeof value === 'string' ? normalizeOpportunityUrl(value) : value,
    z.url('Enter a valid public URL.').refine(value => value.startsWith('http://') || value.startsWith('https://'), 'Use an HTTP or HTTPS URL.'))
}).strict()

export const extractedOpportunityValueSchema = schema => z.object({
  value: schema.nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(240)).max(5)
}).strict()

export const opportunityExtractionCandidateSchema = z.object({
  title: extractedOpportunityValueSchema(z.string()), organisation: extractedOpportunityValueSchema(z.string()), category: extractedOpportunityValueSchema(z.enum(OPPORTUNITY_CATEGORIES)),
  description: extractedOpportunityValueSchema(z.string()), deadline: extractedOpportunityValueSchema(z.string()), startAt: extractedOpportunityValueSchema(z.string()), endAt: extractedOpportunityValueSchema(z.string()), location: extractedOpportunityValueSchema(z.string()),
  mode: extractedOpportunityValueSchema(z.enum(OPPORTUNITY_MODES)), applicationUrl: extractedOpportunityValueSchema(z.string()), sourceUrl: extractedOpportunityValueSchema(z.string()),
  eligibilityText: extractedOpportunityValueSchema(z.string()), requirements: extractedOpportunityValueSchema(z.string()), benefits: extractedOpportunityValueSchema(z.string()),
  tags: extractedOpportunityValueSchema(z.array(z.string()))
}).strict()

export const pasteTextExtractionResultSchema = z.object({
  candidate: opportunityExtractionCandidateSchema,
  warnings: z.array(z.string().max(240)).max(20)
}).strict()

export const linkExtractionResultSchema = pasteTextExtractionResultSchema.extend({
  sourceHost: z.string().min(1).max(253)
}).strict()
