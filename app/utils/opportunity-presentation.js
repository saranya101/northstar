export const OPPORTUNITY_SOURCE_FILTERS = [
  {
    key: 'all',
    label: 'All sources',
    icon: 'i-lucide-layers-3',
  },
  {
    key: 'devpost',
    label: 'Devpost',
    icon: 'i-lucide-code-xml',
  },
  {
    key: 'volunteer-gov-sg',
    label: 'Volunteer.gov.sg',
    icon: 'i-lucide-hand-heart',
  },
  {
    key: 'ntu-events',
    label: 'NTU Events',
    icon: 'i-lucide-calendar-days',
  },
]

const SOURCE_PRESENTATIONS = {
  devpost: {
    key: 'devpost',
    label: 'Devpost',
    icon: 'i-lucide-code-xml',
  },

  'volunteer-gov-sg': {
    key: 'volunteer-gov-sg',
    label: 'Volunteer.gov.sg',
    icon: 'i-lucide-hand-heart',
  },

  'ntu-events': {
    key: 'ntu-events',
    label: 'NTU Events',
    icon: 'i-lucide-calendar-days',
  },

  other: {
    key: 'other',
    label: 'Other source',
    icon: 'i-lucide-globe-2',
  },
}

export function opportunitySourceKey(name) {
  const value = String(name || '')
    .trim()
    .toLocaleLowerCase()

  if (!value) return 'other'

  if (value.includes('devpost')) {
    return 'devpost'
  }

  if (
    value.includes('volunteer.gov.sg')
    || value.includes('volunteer gov sg')
    || value.includes('volunteer-gov-sg')
  ) {
    return 'volunteer-gov-sg'
  }

  if (
    value.includes('ntu events')
    || value.includes('nanyang technological university events')
  ) {
    return 'ntu-events'
  }

  return 'other'
}

export function opportunitySourcePresentation(name) {
  const key = opportunitySourceKey(name)
  const presentation = SOURCE_PRESENTATIONS[key]

  return {
    ...presentation,
    label: key === 'other'
      ? String(name || '').trim() || presentation.label
      : presentation.label,
  }
}

export function opportunitySourceNames(opportunity = {}) {
  const publicNames = Array.isArray(opportunity.publicSourceNames)
    ? opportunity.publicSourceNames
    : []

  const values = [
    ...publicNames,
    opportunity.sourceName,
  ]

  const seen = new Set()

  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(name => {
      const key = name.toLocaleLowerCase()

      if (seen.has(key)) return false

      seen.add(key)
      return true
    })
}

export function opportunityMatchesSource(opportunity, sourceKey) {
  if (!sourceKey || sourceKey === 'all') {
    return true
  }

  if (
    Array.isArray(opportunity.publicSourceKeys)
    && opportunity.publicSourceKeys.includes(sourceKey)
  ) {
    return true
  }

  return opportunitySourceNames(opportunity)
    .some(name => opportunitySourceKey(name) === sourceKey)
}

export function filterOpportunitiesBySource(items, sourceKey) {
  return (Array.isArray(items) ? items : [])
    .filter(item => opportunityMatchesSource(item, sourceKey))
}

export function formatOpportunityDate(
  value,
  timeZone = 'Asia/Singapore',
) {
  if (!value) return 'Not specified'

  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return 'Not specified'
  }

  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date)
}

export function opportunityModeLabel(mode) {
  return {
    ONLINE: 'Online',
    IN_PERSON: 'In person',
    HYBRID: 'Hybrid',
    UNKNOWN: 'Not specified',
  }[mode] || 'Not specified'
}
