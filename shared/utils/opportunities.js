export const OPPORTUNITY_CATEGORY_LABELS = {
  INTERNSHIP: 'Internship', PART_TIME_JOB: 'Part-time job', GRADUATE_PROGRAMME: 'Graduate programme', HACKATHON: 'Hackathon', COMPETITION: 'Competition',
  VOLUNTEERING: 'Volunteering', CLUB: 'Club', LEADERSHIP: 'Leadership', SCHOLARSHIP: 'Scholarship', GRANT: 'Grant', RESEARCH: 'Research',
  EXCHANGE: 'Exchange', SUMMER_PROGRAMME: 'Summer programme', MENTORSHIP: 'Mentorship', ENTREPRENEURSHIP: 'Entrepreneurship', WORKSHOP: 'Workshop',
  TALK: 'Talk', NETWORKING: 'Networking', CERTIFICATION: 'Certification', AMBASSADOR: 'Ambassador', PROJECT: 'Project', OTHER: 'Other'
}

export const OPPORTUNITY_STATUS_LABELS = {
  SAVED: 'Saved', INTERESTED: 'Interested', APPLYING: 'Applying', APPLIED: 'Applied', ACCEPTED: 'Accepted', REJECTED: 'Rejected', COMPLETED: 'Completed', IGNORED: 'Ignored'
}

export function calendarDayDifference(value, now = new Date(), timeZone = 'Asia/Singapore') {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dayNumber = date => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]))
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000
  }
  return dayNumber(new Date(value)) - dayNumber(now)
}

export function opportunityTiming(opportunity, now = new Date(), timeZone = 'Asia/Singapore') {
  if (opportunity.deadline) {
    const days = calendarDayDifference(opportunity.deadline, now, timeZone)
    if (new Date(opportunity.deadline) < now && days <= 0) return { state: 'closed', label: 'Closed', days }
    if (days === 0) return { state: 'today', label: 'Closing today', days }
    if (days === 1) return { state: 'soon', label: 'Closing tomorrow', days }
    return { state: days > 1 ? 'open' : 'closed', label: days > 1 ? `Closing in ${days} days` : 'Closed', days }
  }
  if (opportunity.startAt) {
    const startDays = calendarDayDifference(opportunity.startAt, now, timeZone)
    if (startDays > 0) return { state: 'upcoming', label: `Starts in ${startDays} day${startDays === 1 ? '' : 's'}`, days: startDays }
    if (!opportunity.endAt || new Date(opportunity.endAt) >= now) return { state: 'ongoing', label: 'Ongoing', days: startDays }
  }
  return { state: 'none', label: 'No deadline', days: null }
}
