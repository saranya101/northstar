export const OPPORTUNITY_SECTIONS = {
  internships: {
    label: 'Internships & Jobs',
    description: 'Internships, part-time work and graduate programmes.',
    icon: 'i-lucide-briefcase-business',
    categories: ['INTERNSHIP', 'PART_TIME_JOB', 'GRADUATE_PROGRAMME'],
    subcategories: [
      'Finance',
      'Technology',
      'Data',
      'Product',
      'Consulting',
      'Marketing',
      'Design',
      'Startups',
      'Government',
      'Remote',
    ],
  },

  hackathons: {
    label: 'Hackathons & Competitions',
    description: 'Build, pitch, compete and grow your portfolio.',
    icon: 'i-lucide-code-xml',
    categories: ['HACKATHON', 'COMPETITION', 'PROJECT'],
    subcategories: [
      'AI',
      'Fintech',
      'Data',
      'Cybersecurity',
      'Web Development',
      'Business Case',
      'Social Impact',
      'Sustainability',
      'Design',
      'Open Source',
    ],
  },

  volunteering: {
    label: 'Volunteering',
    description: 'Community projects and meaningful causes.',
    icon: 'i-lucide-hand-heart',
    categories: ['VOLUNTEERING'],
    subcategories: [
      'Education',
      'Youth',
      'Elderly',
      'Environment',
      'Healthcare',
      'Disability',
      'Animals',
      'Community',
      'Events',
      'Social Services',
    ],
  },

  clubs: {
    label: 'Clubs & Leadership',
    description: 'Student organisations, committees and leadership roles.',
    icon: 'i-lucide-users',
    categories: ['CLUB', 'LEADERSHIP', 'AMBASSADOR'],
    subcategories: [
      'Business',
      'Technology',
      'Academic',
      'Career',
      'Cultural',
      'Sports',
      'Arts',
      'Service',
      'Leadership',
      'Publicity',
    ],
  },

  scholarships: {
    label: 'Scholarships & Programmes',
    description: 'Funding, exchanges, mentorships and overseas programmes.',
    icon: 'i-lucide-graduation-cap',
    categories: [
      'SCHOLARSHIP',
      'GRANT',
      'EXCHANGE',
      'SUMMER_PROGRAMME',
      'MENTORSHIP',
    ],
    subcategories: [
      'Merit',
      'Financial Support',
      'Overseas',
      'Industry Sponsored',
      'Women in STEM',
      'Leadership',
      'Research',
      'Entrepreneurship',
    ],
  },

  research: {
    label: 'Research',
    description: 'Undergraduate research and research-assistant opportunities.',
    icon: 'i-lucide-microscope',
    categories: ['RESEARCH'],
    subcategories: [
      'Artificial Intelligence',
      'Business',
      'Finance',
      'Social Science',
      'Sustainability',
      'Healthcare',
      'Engineering',
      'Data Science',
    ],
  },

  events: {
    label: 'Events & Learning',
    description: 'Workshops, talks, certifications and networking.',
    icon: 'i-lucide-calendar-days',
    categories: ['WORKSHOP', 'TALK', 'NETWORKING', 'CERTIFICATION'],
    subcategories: [
      'Career',
      'Networking',
      'Technical Skills',
      'Business Skills',
      'Industry',
      'Leadership',
      'Personal Development',
      'Recruitment',
    ],
  },

  entrepreneurship: {
    label: 'Entrepreneurship',
    description: 'Incubators, startup support, funding and founder programmes.',
    icon: 'i-lucide-rocket',
    categories: ['ENTREPRENEURSHIP'],
    subcategories: [
      'Incubator',
      'Accelerator',
      'Funding',
      'Pitching',
      'Mentorship',
      'Startup Competition',
      'Founder Networking',
    ],
  },
}

export function getOpportunitySection(slug) {
  return OPPORTUNITY_SECTIONS[slug] ?? null
}

export function getSectionForCategory(category) {
  const match = Object.entries(OPPORTUNITY_SECTIONS).find(([, section]) =>
    section.categories.includes(category),
  )

  return match?.[0] ?? null
}

export function getOpportunitySections() {
  return Object.entries(OPPORTUNITY_SECTIONS).map(([slug, section]) => ({
    slug,
    ...section,
  }))
}