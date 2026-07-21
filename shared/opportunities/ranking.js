import {
  getOpportunitySection,
  getSectionForCategory,
} from './taxonomy.js'

export const OPPORTUNITY_RANKING_VERSION = 'opportunity-ranking-v1'

const DAY_MS = 86_400_000

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'bachelor',
  'degree',
  'in',
  'of',
  'programme',
  'program',
  'school',
  'the',
  'university',
  'with',
])

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normaliseText(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9+#&./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function meaningfulTokens(value) {
  return new Set(
    normaliseText(value)
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length >= 2 && !STOP_WORDS.has(token)),
  )
}

function validDateValue(value) {
  if (!value) return null

  const timestamp = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : null
}

function validHttpsUrl(value) {
  if (typeof value !== 'string') return false

  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function containsPhrase(text, phrase) {
  const normalisedPhrase = normaliseText(phrase)

  return normalisedPhrase.length >= 3
    && text.includes(normalisedPhrase)
}

function intersectionSize(left, right) {
  let count = 0

  for (const value of left) {
    if (right.has(value)) count += 1
  }

  return count
}

function buildProfileContext(profile = {}) {
  const programmeName = profile.programmeName ?? ''
  const schoolName = profile.schoolName ?? ''
  const universityName = profile.universityName ?? ''
  const universityShortName = profile.universityShortName ?? ''
  const universityCountry = profile.universityCountry ?? ''
  const degreeType = profile.degreeType ?? ''

  const programmeTokens = meaningfulTokens(programmeName)
  const schoolTokens = meaningfulTokens(schoolName)

  const universityTokens = meaningfulTokens([
    universityName,
    universityShortName,
  ].filter(Boolean).join(' '))

  return {
    programmeName,
    schoolName,
    universityName,
    universityShortName,
    universityCountry,
    degreeType,
    currentYearOfStudy: Number.isInteger(profile.currentYearOfStudy)
      ? profile.currentYearOfStudy
      : null,
    programmeTokens,
    schoolTokens,
    universityTokens,
    allTokens: new Set([
      ...programmeTokens,
      ...schoolTokens,
      ...universityTokens,
      ...meaningfulTokens(degreeType),
    ]),
  }
}

function buildOpportunityText(opportunity) {
  const tags = Array.isArray(opportunity.tags)
    ? opportunity.tags
    : []

  const publicSourceNames = Array.isArray(
    opportunity.publicSourceNames,
  )
    ? opportunity.publicSourceNames
    : []

  return normaliseText([
    opportunity.title,
    opportunity.organisation,
    opportunity.category,
    opportunity.description,
    opportunity.location,
    opportunity.commitment,
    opportunity.eligibilityText,
    opportunity.requirements,
    opportunity.benefits,
    ...tags,
    opportunity.sourceName,
    ...publicSourceNames,
  ].filter(Boolean).join(' '))
}

function scoreProfileMatch(
  opportunity,
  profile,
  opportunityText,
) {
  if (
    profile.allTokens.size === 0
    && !profile.currentYearOfStudy
  ) {
    return 0
  }

  const opportunityTokens = meaningfulTokens(opportunityText)

  let score = 0

  if (
    profile.programmeName
    && containsPhrase(
      opportunityText,
      profile.programmeName,
    )
  ) {
    score += 10
  } else {
    const programmeOverlap = intersectionSize(
      profile.programmeTokens,
      opportunityTokens,
    )

    score += Math.min(10, programmeOverlap * 3)
  }

  if (
    profile.schoolName
    && containsPhrase(
      opportunityText,
      profile.schoolName,
    )
  ) {
    score += 4
  } else {
    const schoolOverlap = intersectionSize(
      profile.schoolTokens,
      opportunityTokens,
    )

    if (schoolOverlap > 0) score += 2
  }

  const universityMatch = [
    profile.universityName,
    profile.universityShortName,
  ].some(value =>
    value
    && containsPhrase(opportunityText, value),
  )

  if (universityMatch) score += 2

  if (profile.currentYearOfStudy) {
    const eligibility = normaliseText([
      opportunity.eligibilityText,
      opportunity.requirements,
    ].filter(Boolean).join(' '))

    const yearPatterns = [
      new RegExp(
        `\\byear\\s*${profile.currentYearOfStudy}\\b`,
        'i',
      ),
      new RegExp(
        `\\by${profile.currentYearOfStudy}\\b`,
        'i',
      ),
    ]

    if (
      yearPatterns.some(pattern =>
        pattern.test(eligibility),
      )
    ) {
      score += 2
    }
  }

  return clamp(score, 0, 18)
}

function scoreCategoryMatch(opportunity, profile) {
  if (profile.allTokens.size === 0) return 0

  const sectionSlug = getSectionForCategory(
    opportunity.category,
  )

  const section = sectionSlug
    ? getOpportunitySection(sectionSlug)
    : null

  if (!section) return 0

  const sectionTokens = meaningfulTokens([
    section.label,
    section.description,
    ...(section.subcategories ?? []),
  ].join(' '))

  const overlap = intersectionSize(
    profile.allTokens,
    sectionTokens,
  )

  if (overlap >= 2) return 12
  if (overlap === 1) return 8

  return 0
}

function scoreTagMatch(opportunity, profile) {
  if (
    !Array.isArray(opportunity.tags)
    || profile.allTokens.size === 0
  ) {
    return 0
  }

  let score = 0

  for (const tag of opportunity.tags) {
    const tagTokens = meaningfulTokens(tag)

    if (
      intersectionSize(
        tagTokens,
        profile.allTokens,
      ) > 0
    ) {
      score += 4
    }
  }

  return clamp(score, 0, 12)
}

function scoreDeadlineUrgency(
  opportunity,
  nowTimestamp,
) {
  const deadline = validDateValue(
    opportunity.deadline,
  )

  if (
    deadline === null
    || deadline < nowTimestamp
  ) {
    return 0
  }

  const daysRemaining = Math.ceil(
    (deadline - nowTimestamp) / DAY_MS,
  )

  if (daysRemaining <= 2) return 14
  if (daysRemaining <= 7) return 11
  if (daysRemaining <= 14) return 8
  if (daysRemaining <= 30) return 4

  return 1
}

function getFreshnessTimestamp(opportunity) {
  return validDateValue(opportunity.firstSeenAt)
    ?? validDateValue(opportunity.publishedAt)
    ?? validDateValue(opportunity.createdAt)
}

function scoreFreshness(
  opportunity,
  nowTimestamp,
) {
  const discoveredAt = getFreshnessTimestamp(
    opportunity,
  )

  if (
    discoveredAt === null
    || discoveredAt > nowTimestamp
  ) {
    return 0
  }

  const ageInDays = Math.floor(
    (nowTimestamp - discoveredAt) / DAY_MS,
  )

  if (ageInDays <= 1) return 10
  if (ageInDays <= 3) return 8
  if (ageInDays <= 7) return 6
  if (ageInDays <= 14) return 4
  if (ageInDays <= 30) return 2

  return 0
}

function locationMatchesProfile(
  opportunity,
  profile,
  opportunityText,
) {
  const location = normaliseText(
    opportunity.location,
  )

  const country = normaliseText(
    profile.universityCountry,
  )

  if (
    country
    && location.includes(country)
  ) {
    return true
  }

  if (
    country === 'singapore'
    && (
      location.includes('singapore')
      || location === 'sg'
    )
  ) {
    return true
  }

  return [
    profile.universityName,
    profile.universityShortName,
  ].some(value =>
    value
    && containsPhrase(opportunityText, value),
  )
}

function scoreModeLocationMatch(
  opportunity,
  profile,
  opportunityText,
) {
  const localMatch = locationMatchesProfile(
    opportunity,
    profile,
    opportunityText,
  )

  if (opportunity.mode === 'ONLINE') {
    return 8
  }

  if (opportunity.mode === 'HYBRID') {
    return localMatch ? 8 : 5
  }

  if (opportunity.mode === 'IN_PERSON') {
    return localMatch ? 8 : 1
  }

  return localMatch ? 3 : 0
}

function scoreSourceQuality(opportunity) {
  let score = 0

  const isPublic = opportunity.isPublic
    || opportunity.sourceType === 'PUBLIC_SOURCE'

  const publicSourceNames = Array.isArray(
    opportunity.publicSourceNames,
  )
    ? opportunity.publicSourceNames
    : []

  if (
    isPublic
    && opportunity.active !== false
  ) {
    score += 5
  }

  if (
    opportunity.sourceName
    || publicSourceNames.length > 0
  ) {
    score += 2
  }

  if (validHttpsUrl(opportunity.sourceUrl)) {
    score += 2
  }

  if (validHttpsUrl(opportunity.applicationUrl)) {
    score += 3
  }

  return clamp(score, 0, 12)
}

function scoreInformationCompleteness(opportunity) {
  let score = 0

  const description = typeof opportunity.description === 'string'
    ? opportunity.description.trim()
    : ''

  if (description.length >= 80) {
    score += 3
  } else if (description.length > 0) {
    score += 1
  }

  if (
    validDateValue(opportunity.deadline) !== null
    || validDateValue(opportunity.startAt) !== null
  ) {
    score += 3
  }

  if (
    typeof opportunity.location === 'string'
    && opportunity.location.trim()
    && opportunity.mode
    && opportunity.mode !== 'UNKNOWN'
  ) {
    score += 2
  }

  if (
    Array.isArray(opportunity.tags)
    && opportunity.tags.length > 0
  ) {
    score += 2
  }

  if (
    opportunity.eligibilityText?.trim()
    || opportunity.requirements?.trim()
    || opportunity.benefits?.trim()
    || opportunity.commitment?.trim()
  ) {
    score += 2
  }

  if (
    validHttpsUrl(opportunity.applicationUrl)
    || validHttpsUrl(opportunity.sourceUrl)
  ) {
    score += 2
  }

  return clamp(score, 0, 14)
}

function calculatePenalties(
  opportunity,
  nowTimestamp,
) {
  let penalties = 0

  const deadline = validDateValue(
    opportunity.deadline,
  )

  const endAt = validDateValue(
    opportunity.endAt,
  )

  if (opportunity.active === false) {
    penalties -= 15
  }

  if (
    deadline !== null
    && deadline < nowTimestamp
  ) {
    penalties -= 20
  }

  if (
    endAt !== null
    && endAt < nowTimestamp
  ) {
    penalties -= 15
  }

  const informationSignals = [
    Boolean(opportunity.description?.trim()),
    deadline !== null
      || validDateValue(opportunity.startAt) !== null,
    Boolean(opportunity.location?.trim()),
    Boolean(
      Array.isArray(opportunity.tags)
      && opportunity.tags.length > 0,
    ),
    Boolean(
      opportunity.eligibilityText?.trim()
      || opportunity.requirements?.trim(),
    ),
    validHttpsUrl(opportunity.sourceUrl)
      || validHttpsUrl(opportunity.applicationUrl),
  ].filter(Boolean).length

  if (informationSignals <= 2) {
    penalties -= 10
  }

  const publicSourceNames = Array.isArray(
    opportunity.publicSourceNames,
  )
    ? opportunity.publicSourceNames
    : []

  if (
    opportunity.sourceType === 'PUBLIC_SOURCE'
    && !validHttpsUrl(opportunity.sourceUrl)
    && publicSourceNames.length === 0
  ) {
    penalties -= 5
  }

  return clamp(penalties, -35, 0)
}

function buildRecommendationReasons(
  opportunity,
  profile,
  breakdown,
  nowTimestamp,
  opportunityText,
) {
  const reasons = []

  if (
    breakdown.profileMatch >= 4
    && profile.programmeName
  ) {
    reasons.push(
      `Matches your ${profile.programmeName} programme`,
    )
  }

  const publicSourceNames = Array.isArray(
    opportunity.publicSourceNames,
  )
    ? opportunity.publicSourceNames
    : []

  const sourceText = normaliseText([
    opportunity.sourceName,
    ...publicSourceNames,
  ].filter(Boolean).join(' '))

  const eventCategories = [
    'WORKSHOP',
    'TALK',
    'NETWORKING',
    'CERTIFICATION',
    'OTHER',
  ]

  if (
    (
      sourceText.includes('ntu')
      || sourceText.includes(
        'nanyang technological university',
      )
    )
    && eventCategories.includes(opportunity.category)
  ) {
    reasons.push('NTU event')
  }

  const deadline = validDateValue(
    opportunity.deadline,
  )

  if (
    deadline !== null
    && deadline >= nowTimestamp
    && deadline <= nowTimestamp + (7 * DAY_MS)
  ) {
    reasons.push('Closing soon')
  }

  const freshnessTimestamp = getFreshnessTimestamp(
    opportunity,
  )

  if (
    freshnessTimestamp !== null
    && freshnessTimestamp <= nowTimestamp
    && freshnessTimestamp >= nowTimestamp - (7 * DAY_MS)
  ) {
    reasons.push('Recently discovered')
  }

  const localMatch = locationMatchesProfile(
    opportunity,
    profile,
    opportunityText,
  )

  if (
    opportunity.mode === 'IN_PERSON'
    && localMatch
    && normaliseText(
      profile.universityCountry,
    ) === 'singapore'
  ) {
    reasons.push('In-person in Singapore')
  }

  if (opportunity.mode === 'ONLINE') {
    reasons.push('Online opportunity')
  }

  if (
    breakdown.informationCompleteness >= 11
  ) {
    reasons.push(
      'Complete application information',
    )
  }

  return reasons.slice(0, 5)
}

export function scoreOpportunity(
  opportunity,
  profile = {},
  now = new Date(),
) {
  const nowTimestamp = validDateValue(now)

  if (nowTimestamp === null) {
    throw new TypeError(
      'Ranking requires a valid current time.',
    )
  }

  const rankingProfile = buildProfileContext(profile)

  const opportunityText = buildOpportunityText(
    opportunity,
  )

  const scoreBreakdown = {
    profileMatch: scoreProfileMatch(
      opportunity,
      rankingProfile,
      opportunityText,
    ),

    categoryMatch: scoreCategoryMatch(
      opportunity,
      rankingProfile,
    ),

    tagMatch: scoreTagMatch(
      opportunity,
      rankingProfile,
    ),

    deadlineUrgency: scoreDeadlineUrgency(
      opportunity,
      nowTimestamp,
    ),

    freshness: scoreFreshness(
      opportunity,
      nowTimestamp,
    ),

    modeLocationMatch: scoreModeLocationMatch(
      opportunity,
      rankingProfile,
      opportunityText,
    ),

    sourceQuality: scoreSourceQuality(
      opportunity,
    ),

    informationCompleteness:
      scoreInformationCompleteness(
        opportunity,
      ),

    penalties: calculatePenalties(
      opportunity,
      nowTimestamp,
    ),
  }

  const relevanceScore = clamp(
    Object.values(scoreBreakdown)
      .reduce(
        (total, componentScore) =>
          total + componentScore,
        0,
      ),
    0,
    100,
  )

  return {
    relevanceScore,
    scoreBreakdown,
    recommendationReasons:
      buildRecommendationReasons(
        opportunity,
        rankingProfile,
        scoreBreakdown,
        nowTimestamp,
        opportunityText,
      ),
    rankingVersion:
      OPPORTUNITY_RANKING_VERSION,
  }
}

function compareNullableDates(
  left,
  right,
  direction = 'asc',
) {
  const leftDate = validDateValue(left)
  const rightDate = validDateValue(right)

  if (
    leftDate === null
    && rightDate === null
  ) {
    return 0
  }

  if (leftDate === null) return 1
  if (rightDate === null) return -1

  return direction === 'desc'
    ? rightDate - leftDate
    : leftDate - rightDate
}

export function compareRankedOpportunities(
  left,
  right,
) {
  if (
    left.relevanceScore
    !== right.relevanceScore
  ) {
    return right.relevanceScore
      - left.relevanceScore
  }

  const leftActive = left.active !== false
  const rightActive = right.active !== false

  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1
  }

  const deadlineComparison = compareNullableDates(
    left.deadline,
    right.deadline,
  )

  if (deadlineComparison !== 0) {
    return deadlineComparison
  }

  const freshnessComparison = compareNullableDates(
    left.firstSeenAt,
    right.firstSeenAt,
    'desc',
  )

  if (freshnessComparison !== 0) {
    return freshnessComparison
  }

  return String(left.id).localeCompare(
    String(right.id),
  )
}

export function rankOpportunities(
  opportunities,
  profile = {},
  now = new Date(),
) {
  if (!Array.isArray(opportunities)) {
    throw new TypeError(
      'Opportunities must be an array.',
    )
  }

  return opportunities
    .map(opportunity => ({
      ...opportunity,
      ...scoreOpportunity(
        opportunity,
        profile,
        now,
      ),
    }))
    .sort(compareRankedOpportunities)
}