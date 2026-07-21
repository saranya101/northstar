import { createError } from 'h3'
import { prisma } from '../utils/prisma'
import { normalizeOpportunityUrl } from '~~/shared/schemas/opportunities'

const personalInclude = userId => ({ userOpportunities: { where: { userId }, take: 1 } })
const visibleWhere = userId => ({ OR: [{ createdByUserId: userId }, { createdByUserId: null }] })
const dateValue = value => value instanceof Date ? value.toISOString() : value ?? null

export function serializeOpportunity(record, userId) {
  const personal = record.userOpportunities?.find(item => item.userId === userId) || record.userOpportunities?.[0] || null
  return {
    id: record.id, title: record.title, organisation: record.organisation, category: record.category, description: record.description,
    sourceType: record.sourceType, sourceName: record.sourceName, sourceUrl: record.sourceUrl, applicationUrl: record.applicationUrl,
    publishedAt: dateValue(record.publishedAt), deadline: dateValue(record.deadline), startAt: dateValue(record.startAt), endAt: dateValue(record.endAt),
    location: record.location, mode: record.mode, commitment: record.commitment, eligibilityText: record.eligibilityText,
    requirements: record.requirements, benefits: record.benefits, tags: record.tags, createdByUserId: record.createdByUserId,
    isOwner: record.createdByUserId === userId, createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt),
    personal: personal ? { id: personal.id, status: personal.status, personalDeadline: dateValue(personal.personalDeadline), notes: personal.notes, savedAt: dateValue(personal.savedAt), appliedAt: dateValue(personal.appliedAt) } : null
  }
}

function toDates(input) {
  const result = { ...input }
  for (const key of ['publishedAt', 'deadline', 'startAt', 'endAt']) if (result[key]) result[key] = new Date(result[key])
  return result
}

function opportunityOrder(sort) {
  if (sort === 'newest') return [{ opportunity: { createdAt: 'desc' } }]
  if (sort === 'title') return [{ opportunity: { title: 'asc' } }]
  return [{ opportunity: { deadline: { sort: 'asc', nulls: 'last' } } }, { opportunity: { createdAt: 'desc' } }]
}

export async function listOpportunities(userId, filters, database = prisma, now = new Date()) {
  const where = {
    userId,
    ...(filters.status && { status: filters.status }),
    opportunity: {
      ...visibleWhere(userId),
      ...(filters.category && { category: filters.category }),
      ...(filters.search && { OR: [{ title: { contains: filters.search, mode: 'insensitive' } }, { organisation: { contains: filters.search, mode: 'insensitive' } }, { description: { contains: filters.search, mode: 'insensitive' } }] }),
      ...(filters.closingSoon && { deadline: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } }),
      ...(filters.upcoming && { startAt: { gt: now } }),
      ...(filters.expired && { deadline: { lt: now } })
    }
  }
  const skip = (filters.page - 1) * filters.pageSize
  const [rows, total, closingSoonCount, applicationsInProgress] = await Promise.all([
    database.userOpportunity.findMany({ where, include: { opportunity: true }, orderBy: opportunityOrder(filters.sort), skip, take: filters.pageSize }),
    database.userOpportunity.count({ where }),
    database.userOpportunity.count({ where: { userId, opportunity: { ...visibleWhere(userId), deadline: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } } } }),
    database.userOpportunity.count({ where: { userId, status: { in: ['APPLYING', 'APPLIED'] }, opportunity: visibleWhere(userId) } })
  ])
  const items = rows.map(row => serializeOpportunity({ ...row.opportunity, userOpportunities: [row] }, userId))
  return { items, total, page: filters.page, pageSize: filters.pageSize, pageCount: Math.ceil(total / filters.pageSize), summary: { closingSoonCount, applicationsInProgress } }
}

export async function createOpportunity(userId, input, database = prisma, now = new Date()) {
  const { allowDuplicate, ...opportunityInput } = input
  const duplicates = await findOpportunityDuplicates(userId, opportunityInput, database)
  if (duplicates.length && !allowDuplicate) throw createError({ statusCode: 409, statusMessage: 'You already saved an opportunity with this link.', data: { duplicates } })
  return database.$transaction(async transaction => {
    const opportunity = await transaction.opportunity.create({ data: { ...toDates(opportunityInput), createdByUserId: userId } })
    const personal = await transaction.userOpportunity.create({ data: { userId, opportunityId: opportunity.id, status: 'SAVED', savedAt: now } })
    return serializeOpportunity({ ...opportunity, userOpportunities: [personal] }, userId)
  })
}

export async function findOpportunityDuplicates(userId, input, database = prisma) {
  const sourceUrl = input.sourceUrl ? normalizeOpportunityUrl(input.sourceUrl) : null
  const applicationUrl = input.applicationUrl ? normalizeOpportunityUrl(input.applicationUrl) : null
  const urlConditions = []
  if (sourceUrl) urlConditions.push({ sourceUrl })
  if (applicationUrl) urlConditions.push({ applicationUrl })
  if (!urlConditions.length) return []
  const rows = await database.userOpportunity.findMany({
    where: { userId, opportunity: { OR: [{ sourceUrl: { not: null } }, { applicationUrl: { not: null } }] } },
    include: { opportunity: true },
    take: 5
  })
  return rows.filter(row => (sourceUrl && normalizeOpportunityUrl(row.opportunity.sourceUrl) === sourceUrl) || (applicationUrl && normalizeOpportunityUrl(row.opportunity.applicationUrl) === applicationUrl)).map(row => ({ id: row.opportunity.id, title: row.opportunity.title, organisation: row.opportunity.organisation, sourceUrl: row.opportunity.sourceUrl, applicationUrl: row.opportunity.applicationUrl }))
}

export async function getOpportunity(userId, id, database = prisma) {
  const record = await database.opportunity.findFirst({ where: { id, ...visibleWhere(userId) }, include: personalInclude(userId) })
  if (!record || (record.createdByUserId === userId && !record.userOpportunities.length)) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  return serializeOpportunity(record, userId)
}

export async function updateOpportunity(userId, id, input, database = prisma) {
  const owned = await database.opportunity.findFirst({ where: { id, createdByUserId: userId } })
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  const startAt = input.startAt === null ? null : input.startAt ? new Date(input.startAt) : owned.startAt
  const endAt = input.endAt === null ? null : input.endAt ? new Date(input.endAt) : owned.endAt
  if (startAt && endAt && endAt < startAt) throw createError({ statusCode: 400, statusMessage: 'End date cannot be before start date.', data: { fieldErrors: { endAt: 'End date cannot be before start date.' } } })
  const record = await database.opportunity.update({ where: { id }, data: toDates(input), include: personalInclude(userId) })
  return serializeOpportunity(record, userId)
}

export async function deleteOpportunity(userId, id, database = prisma) {
  const owned = await database.opportunity.findFirst({ where: { id, createdByUserId: userId }, select: { id: true } })
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  await database.opportunity.delete({ where: { id } })
  return { id, deleted: true }
}

export async function updateOpportunityStatus(userId, id, input, database = prisma, now = new Date()) {
  const opportunity = await database.opportunity.findFirst({ where: { id, ...visibleWhere(userId) }, select: { id: true, createdByUserId: true } })
  if (!opportunity) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  const existing = await database.userOpportunity.findUnique({ where: { userId_opportunityId: { userId, opportunityId: id } } })
  if (!existing && opportunity.createdByUserId === userId) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  const data = { ...input }
  for (const key of ['personalDeadline', 'savedAt', 'appliedAt']) if (data[key]) data[key] = new Date(data[key])
  if (input.status === 'SAVED' && !existing?.savedAt && !data.savedAt) data.savedAt = now
  if (input.status === 'APPLIED' && !existing?.appliedAt && !data.appliedAt) data.appliedAt = now
  const personal = await database.userOpportunity.upsert({
    where: { userId_opportunityId: { userId, opportunityId: id } },
    create: { userId, opportunityId: id, status: input.status || 'SAVED', savedAt: input.status === 'SAVED' ? (data.savedAt || now) : data.savedAt, appliedAt: data.appliedAt, personalDeadline: data.personalDeadline, notes: data.notes },
    update: data
  })
  const record = await database.opportunity.findUnique({ where: { id } })
  return serializeOpportunity({ ...record, userOpportunities: [personal] }, userId)
}
