export const OPPORTUNITY_VALUE_VERSION = 'opportunity-value-v2'

const ACTIVE_CATEGORIES = new Set([
  'HACKATHON',
  'COMPETITION',
  'PROJECT',
  'RESEARCH',
  'ENTREPRENEURSHIP',
  'LEADERSHIP',
  'AMBASSADOR',
])

const PASSIVE_CATEGORIES = new Set([
  'TALK',
  'WORKSHOP',
  'NETWORKING',
  'CERTIFICATION',
])

const PROFESSIONAL_CATEGORIES = new Set([
  'INTERNSHIP',
  'PART_TIME_JOB',
  'GRADUATE_PROGRAMME',
])

const GOAL_LABELS = Object.freeze({
  LEADERSHIP: 'Leadership',
  TECHNICAL_SKILLS: 'Technical skills',
  COMMUNITY_IMPACT: 'Community impact',
  BUSINESS_EXPERIENCE: 'Business experience',
  RESEARCH_EXPERIENCE: 'Research experience',
  ENTREPRENEURSHIP: 'Entrepreneurship',
  SCHOLARSHIP_EVIDENCE: 'Scholarship evidence',
  TRANSFER_APPLICATION_EVIDENCE: 'Transfer application evidence',
  NETWORKING: 'Networking',
  RESUME_BUILDING: 'Resume building',
})

const GOAL_SIGNALS = Object.freeze({
  LEADERSHIP: ['lead', 'leader', 'coordinate', 'manage', 'captain', 'organise', 'organize', 'ownership'],
  TECHNICAL_SKILLS: ['software', 'code', 'coding', 'developer', 'data', 'engineering', 'technical', 'prototype', 'design'],
  COMMUNITY_IMPACT: ['community', 'volunteer', 'social impact', 'beneficiary', 'outreach', 'service'],
  BUSINESS_EXPERIENCE: ['business', 'marketing', 'finance', 'strategy', 'operations', 'consulting'],
  RESEARCH_EXPERIENCE: ['research', 'laboratory', 'study', 'analysis', 'academic', 'publication'],
  ENTREPRENEURSHIP: ['startup', 'venture', 'founder', 'entrepreneur', 'pitch', 'innovation'],
  SCHOLARSHIP_EVIDENCE: ['scholarship', 'leadership', 'community', 'achievement', 'impact'],
  TRANSFER_APPLICATION_EVIDENCE: ['academic', 'project', 'research', 'leadership', 'community'],
  NETWORKING: ['network', 'mentor', 'industry', 'conference', 'speaker', 'professional'],
  RESUME_BUILDING: ['intern', 'project', 'leadership', 'competition', 'research', 'volunteer'],
})

const normalise = value => String(value ?? '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9+#&./ -]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const unique = values => [...new Set(values.filter(Boolean))]
const clamp = value => Math.min(100, Math.max(0, Math.round(value)))

function opportunityText(opportunity) {
  return normalise([
    opportunity.title,
    opportunity.organisation,
    opportunity.category,
    opportunity.description,
    opportunity.eligibilityText,
    opportunity.requirements,
    opportunity.benefits,
    opportunity.commitment,
    ...(opportunity.tags || []),
  ].filter(Boolean).join(' '))
}

function hasAny(text, values) {
  return values.some(value => text.includes(normalise(value)))
}

function selectedGoalMatches(text, preferences) {
  return (preferences.portfolioGoals || []).filter(goal =>
    hasAny(text, GOAL_SIGNALS[goal] || []),
  )
}

function skillMatches(text, preferences) {
  return (preferences.skillGoals || []).filter(skill =>
    normalise(skill).length >= 2 && text.includes(normalise(skill)),
  )
}

function profileRelevance(text, profile) {
  const fields = [
    profile.programmeName,
    profile.schoolName,
    profile.universityName,
    profile.universityShortName,
    profile.degreeType,
  ].map(normalise).filter(value => value.length >= 3)

  return fields.filter(value => text.includes(value)).length
}

function isExpired(opportunity, now) {
  const deadline = opportunity.deadline
    ? new Date(opportunity.deadline).getTime()
    : null
  const endAt = opportunity.endAt
    ? new Date(opportunity.endAt).getTime()
    : null
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime()

  return Boolean(
    (Number.isFinite(deadline) && deadline < timestamp)
    || (!deadline && Number.isFinite(endAt) && endAt < timestamp),
  )
}

function recordCompleteness(opportunity) {
  const fields = [
    opportunity.description,
    opportunity.deadline,
    opportunity.startAt,
    opportunity.location || opportunity.mode,
    opportunity.eligibilityText || opportunity.requirements,
    opportunity.applicationUrl || opportunity.sourceUrl,
  ]

  return fields.filter(Boolean).length
}

function resumeTemplate(opportunity, signals) {
  const organisation = opportunity.organisation || '[organisation]'

  if (signals.leadership) {
    return `Led [activity or workstream] for ${organisation}, supporting [X participants or stakeholders] and achieving [truthful measurable outcome].`
  }

  if (signals.deliverable) {
    return `Created [project or deliverable] for ${organisation}, using [relevant skills] to address [problem] and achieving [truthful measurable outcome].`
  }

  if (signals.active) {
    return `Contributed to [activity] with ${organisation}, completing [specific responsibility] and documenting [truthful outcome or learning].`
  }

  return null
}

function headlineFor(level, signals, goalMatches) {
  if (signals.leadership) return 'Strong leadership and ownership potential'
  if (signals.deliverable) return 'Good potential for tangible portfolio evidence'
  if (goalMatches.includes('COMMUNITY_IMPACT')) return 'Useful community-impact evidence'
  if (signals.networking) return 'Potential professional networking value'
  if (level === 'HIGH') return 'Strongly aligned portfolio opportunity'
  if (level === 'MEDIUM') return 'Useful with intentional participation'
  return 'Limited evidence unless you create a follow-up output'
}

function categoryGuidance(category, signals, level) {
  if (category === 'HACKATHON' || category === 'COMPETITION') {
    return {
      headline: level === 'HIGH'
        ? 'Strong product execution evidence'
        : 'Product execution evidence with a completed submission',
      summary: 'This can help demonstrate product thinking, technical implementation, teamwork and presentation when you build and retain a working submission. Registration alone does not provide strong portfolio evidence.',
      skills: [
        'Product execution',
        'Technical decision-making',
      ],
      evidence: [
        'Save the demo, repository and any judging feedback you are allowed to retain.',
        'Record the technical or product decisions you personally made.',
        'Measure a truthful project outcome such as users, accuracy or speed.',
      ],
      actions: [
        'Own one complete product feature or clearly defined part of the submission.',
        'Document your decisions and the outcome you can verify.',
      ],
    }
  }

  if (category === 'VOLUNTEERING') {
    if (
      signals.leadership
      || signals.ownership
      || signals.volunteerResponsibility
      || signals.measurableImpact
    ) {
      return {
        headline: 'Strong facilitation and leadership evidence',
        summary: 'This may provide evidence of coordination, responsibility and community impact when you lead an activity, manage logistics or own a defined workstream. Keep the claim proportional to the responsibility you actually hold.',
        skills: [
          'Volunteer coordination',
          'Community facilitation',
        ],
        evidence: [
          'Record the activity area or workstream you were responsible for.',
          'Track a truthful measure of people supported or work completed.',
          'Request organiser feedback on your contribution.',
        ],
        actions: [
          'Ask to lead one activity area or own a defined workstream.',
          'Record a problem you solved and the outcome you can verify.',
        ],
      }
    }

    return {
      headline: 'Useful community engagement evidence',
      summary: 'General participation can show community involvement, but usually provides limited evidence of leadership or impact. It becomes stronger when you take a defined responsibility and obtain organiser feedback.',
      skills: [
        'Community engagement',
      ],
      evidence: [
        'Request organiser feedback or confirmation of your contribution.',
      ],
      actions: [
        'Ask to own one clearly defined responsibility during the activity.',
      ],
    }
  }

  if (
    PASSIVE_CATEGORIES.has(category)
    && signals.passive
  ) {
    return {
      headline: 'Limited evidence from attendance alone',
      summary: 'Attendance alone usually provides limited portfolio evidence. It may become useful when you make a relevant connection, document a practical takeaway or apply the learning in coursework or a follow-up project.',
      skills: [],
      evidence: [
        'Save a short reflection, article or practical follow-up project.',
        'Record a relevant professional follow-up and what resulted from it.',
      ],
      actions: [
        'Publish a short reflection or build a follow-up project using what you learned.',
      ],
    }
  }

  if (category === 'LEADERSHIP') {
    return {
      headline: level === 'HIGH'
        ? 'Strong decision-making and team leadership evidence'
        : 'Decision-making and team leadership evidence',
      summary: 'This can help demonstrate responsibility, team coordination and stakeholder management when you own decisions and can verify the resulting work or outcome.',
      skills: [
        'Decision-making',
        'Stakeholder management',
      ],
      evidence: [
        'Document the decisions, stakeholders and workstream you were responsible for.',
        'Record a truthful team or project outcome.',
      ],
      actions: [
        'Define the decision or outcome you will own before starting.',
        'Request feedback from a stakeholder or team member.',
      ],
    }
  }

  if (category === 'RESEARCH') {
    return {
      headline: level === 'HIGH'
        ? 'Strong research and analytical evidence'
        : 'Research and analytical evidence',
      summary: 'This may provide evidence of research methods, literature review, analysis and data work when you contribute to a verifiable written or presented output.',
      skills: [
        'Research methods',
        'Analysis',
      ],
      evidence: [
        'Retain an approved report, poster, analysis or publication contribution.',
        'Document the method, data work or literature review you completed.',
      ],
      actions: [
        'Agree on a specific research output or analytical responsibility.',
        'Record the method you used and the conclusion it supported.',
      ],
    }
  }

  if (PROFESSIONAL_CATEGORIES.has(category)) {
    return {
      headline: 'Professional delivery and responsibility evidence',
      summary: 'This can help demonstrate professional delivery, stakeholder exposure and business or technical responsibility when your contribution and work outcomes can be verified.',
      skills: [
        'Professional delivery',
        'Stakeholder communication',
      ],
      evidence: [
        'Keep approved examples of work and feedback that verify your contribution.',
        'Record a truthful business, technical or operational outcome.',
      ],
      actions: [
        'Clarify the work outcome or responsibility you will own.',
        'Request a reference or verified feedback on your delivery.',
      ],
    }
  }

  return null
}

export function scoreOpportunityPortfolioValue(
  opportunity,
  preferences = {},
  profile = {},
  now = new Date(),
) {
  const text = opportunityText(opportunity)
  const matchedGoals = selectedGoalMatches(text, preferences)
  const matchedSkills = skillMatches(text, preferences)
  const category = opportunity.category || 'OTHER'
  const active = ACTIVE_CATEGORIES.has(category)
    || hasAny(text, ['participate', 'build', 'submit', 'contribute', 'volunteer'])
  const passive = PASSIVE_CATEGORIES.has(category)
    && !hasAny(text, ['project', 'challenge', 'facilitate', 'organise', 'organize'])
  const leadership = category === 'LEADERSHIP'
    || hasAny(text, ['lead', 'coordinate', 'captain', 'organise', 'organize', 'manage a team'])
  const ownership = leadership
    || hasAny(text, ['own a', 'ownership', 'independent', 'workstream', 'project lead'])
  const deliverable = ['HACKATHON', 'COMPETITION', 'PROJECT', 'RESEARCH'].includes(category)
    || hasAny(text, ['prototype', 'portfolio', 'submission', 'report', 'publication', 'pitch', 'deliverable'])
  const measurableImpact = hasAny(text, ['impact', 'participants', 'beneficiaries', 'outcome', 'metric', 'fundrais'])
  const volunteerResponsibility = category === 'VOLUNTEERING'
    && hasAny(text, ['facilitat', 'manage logistics', 'managing logistics', 'activity lead', 'workstream'])
  const networking = category === 'NETWORKING'
    || hasAny(text, ['networking', 'mentor', 'industry leaders', 'conference', 'professional'])
  const credibility = Boolean(
    opportunity.organisation
    && (opportunity.sourceUrl || opportunity.applicationUrl || opportunity.publicSourceNames?.length),
  )
  const completeness = recordCompleteness(opportunity)
  const expired = isExpired(opportunity, now)
  const inactive = opportunity.active === false
  const profileMatches = profileRelevance(text, profile)

  let score = 18
  score += Math.min(18, matchedGoals.length * 6)
  score += Math.min(12, matchedSkills.length * 4)
  score += Math.min(10, profileMatches * 4)
  score += active ? 7 : 0
  score += leadership ? 8 : 0
  score += ownership && !leadership ? 5 : 0
  score += deliverable ? 10 : 0
  score += measurableImpact ? 4 : 0
  score += volunteerResponsibility ? 5 : 0
  score += networking ? 3 : 0
  score += credibility ? 4 : 0
  score += Math.min(6, completeness)
  score += category === 'VOLUNTEERING' ? 6 : 0

  if (
    category === 'VOLUNTEERING'
    && !leadership
    && !ownership
    && !volunteerResponsibility
    && !measurableImpact
  ) {
    score = Math.min(score, 64)
  }
  if (passive) score -= 12
  if (completeness <= 2) score -= 8
  if (expired) score -= 30
  if (inactive) score -= 25

  const finalScore = clamp(score)
  const level = finalScore >= 75
    ? 'HIGH'
    : finalScore >= 45
      ? 'MEDIUM'
      : 'LOW'
  const signals = {
    active,
    passive,
    leadership,
    ownership,
    deliverable,
    measurableImpact,
    networking,
    volunteerResponsibility,
  }

  const guidance = categoryGuidance(
    category,
    signals,
    level,
  )
  const skillSignals = unique([
    ...matchedSkills,
    ...(guidance?.skills || []),
    leadership && 'Team leadership',
    ownership && 'Ownership',
    deliverable && 'Project delivery',
    measurableImpact && 'Impact measurement',
    networking && 'Professional communication',
  ])

  const goalMatches = matchedGoals.map(goal => GOAL_LABELS[goal])
  const evidenceIdeas = unique([
    ...(guidance?.evidence || []),
    deliverable && 'Save the approved project, submission, report or other output.',
    measurableImpact && 'Record a truthful before-and-after measure or outcome.',
    leadership && 'Document your responsibilities and the team or workstream you led.',
    active && 'Request feedback or confirmation of your contribution.',
    networking && 'Record meaningful follow-up actions or connections.',
    passive && 'Create a reflection, article or small follow-up project.',
  ])
  const maximiseActions = unique([
    ...(guidance?.actions || []),
    leadership ? 'Define the outcome you will own before starting.' : active && 'Ask to own one clearly defined responsibility.',
    deliverable && 'Agree what tangible output you can retain or describe.',
    measurableImpact && 'Choose a truthful measure to track before the activity.',
    networking && 'Plan one relevant question and a concrete follow-up.',
    passive && 'Turn attendance into an original follow-up output.',
  ])

  return {
    score: finalScore,
    level,
    headline: guidance?.headline
      || headlineFor(level, signals, matchedGoals),
    summary: guidance?.summary
      || (active
        ? 'This can help demonstrate contribution when you take responsibility, retain approved evidence and describe only outcomes you can verify.'
        : 'This may be useful when you turn attendance into a truthful follow-up output or meaningful professional connection.'),
    skillSignals,
    goalMatches,
    evidenceIdeas,
    maximiseActions,
    resumeBulletTemplate: resumeTemplate(opportunity, signals),
    version: OPPORTUNITY_VALUE_VERSION,
  }
}
