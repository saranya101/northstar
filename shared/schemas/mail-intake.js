import { z } from 'zod'

export const MAIL_CLASSIFICATIONS = ['ACTION_REQUIRED', 'ACADEMIC_ADMIN', 'OPPORTUNITY', 'EVENT', 'NOISE', 'UNCERTAIN']
export const MAIL_CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW']
export const MAIL_INTAKE_STATUSES = ['NEW', 'REVIEWED', 'CONVERTED', 'ARCHIVED', 'DISMISSED']

const blank = value => value === '' || value === null || value === undefined ? undefined : value
const text = (maximum, minimum = 1) => z.preprocess(blank, z.string().trim().min(minimum).max(maximum).optional())
const date = z.preprocess(blank, z.iso.datetime({ offset: true }).optional())
const mailLinkSchema = z.object({
  text: z.string().trim().max(500).default(''),
  url: z.url().max(2000).refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP links are accepted.')
}).strict()

export const createMailIntakeSchema = z.object({
  subject: text(300),
  senderName: text(240),
  senderEmail: z.preprocess(blank, z.email().max(320).optional()),
  receivedAt: date,
  rawText: z.string().trim().min(20, 'Paste at least 20 characters.').max(50_000),
  links: z.array(mailLinkSchema).max(100).optional()
}).strict()

export const createMailBatchSchema = z.object({
  messages: z.array(createMailIntakeSchema).min(1).max(20)
}).strict()

export const mailDecisionSchema = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict()

export const convertMailOpportunitySchema = mailDecisionSchema.extend({
  opportunity: z.object({
    title: text(180), organisation: text(180), category: text(60), description: text(5000),
    sourceUrl: text(2000), applicationUrl: text(2000), deadline: date, startAt: date, endAt: date,
    location: text(240), mode: text(30), commitment: text(500), eligibilityText: text(3000),
    requirements: text(3000), benefits: text(3000), tags: z.array(z.string().trim().min(1).max(40)).max(12).optional()
  }).strict().optional()
}).strict()

export const convertMailTaskSchema = mailDecisionSchema.extend({
  title: text(240),
  dueAt: date
}).strict()
