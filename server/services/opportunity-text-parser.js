const MONTHS = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 }

const CATEGORY_RULES = [
  ['INTERNSHIP', /\bintern(ship)?\b/i], ['PART_TIME_JOB', /\bpart[ -]?time\b/i], ['GRADUATE_PROGRAMME', /\bgraduate (programme|program)\b/i],
  ['HACKATHON', /\bhackathon\b/i], ['COMPETITION', /\b(competition|challenge|contest)\b/i], ['VOLUNTEERING', /\bvolunteer/i],
  ['SCHOLARSHIP', /\bscholarship\b/i], ['GRANT', /\bgrant\b/i], ['RESEARCH', /\bresearch\b/i], ['EXCHANGE', /\bexchange\b/i],
  ['SUMMER_PROGRAMME', /\bsummer (programme|program|school)\b/i], ['MENTORSHIP', /\bmentor(ship|ing)?\b/i], ['ENTREPRENEURSHIP', /\b(entrepreneur|startup|venture)\b/i],
  ['WORKSHOP', /\bworkshop\b/i], ['NETWORKING', /\bnetworking\b/i], ['CERTIFICATION', /\bcertificat(ion|e)\b/i], ['AMBASSADOR', /\bambassador\b/i],
  ['LEADERSHIP', /\bleader(ship)?\b/i], ['CLUB', /\bclub\b/i], ['TALK', /\b(talk|seminar|webinar)\b/i], ['PROJECT', /\bportfolio project\b/i]
]

function field(value = null, confidence = 0, warnings = []) { return { value, confidence, warnings } }
function clean(value) { return value?.replace(/^[\s:*#-]+|[\s;|]+$/g, '').trim() || null }

function dateFromParts(day, month, year, hours = 0, minutes = 0, timeZone = 'Asia/Singapore') {
  const desired = Date.UTC(Number(year), Number(month), Number(day), Number(hours), Number(minutes))
  const calendarCheck = new Date(desired)
  if (calendarCheck.getUTCFullYear() !== Number(year) || calendarCheck.getUTCMonth() !== Number(month) || calendarCheck.getUTCDate() !== Number(day)) return null
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  let instant = desired
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]))
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    instant += desired - represented
  }
  const result = new Date(instant)
  return result.toISOString()
}

export function parseOpportunityDateFragment(fragment, timeZone = 'Asia/Singapore') {
  const text = fragment.trim()
  let match = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):([0-5]\d))?\b/)
  if (match) return dateFromParts(match[3], Number(match[2]) - 1, match[1], match[4] || 0, match[5] || 0, timeZone)
  match = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})(?:\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?)?\b/i)
  if (match) {
    let hour = Number(match[4] || 0)
    if (match[6]?.toLowerCase() === 'pm' && hour < 12) hour += 12
    if (match[6]?.toLowerCase() === 'am' && hour === 12) hour = 0
    return dateFromParts(match[1], Number(match[2]) - 1, match[3], hour, match[5] || 0, timeZone)
  }
  match = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(20\d{2})(?:\s*(?:,|at)?\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?)?\b/i)
  if (!match) return null
  let hour = Number(match[4] || 0)
  if (match[6]?.toLowerCase() === 'pm' && hour < 12) hour += 12
  if (match[6]?.toLowerCase() === 'am' && hour === 12) hour = 0
  return dateFromParts(match[1], MONTHS[match[2].toLowerCase()], match[3], hour, match[5] || 0, timeZone)
}

function labeledLine(lines, labels) {
  const expression = new RegExp(`^(?:${labels.join('|')})\\s*[:–-]\\s*(.+)$`, 'i')
  for (const line of lines) {
    const match = line.match(expression)
    if (match) return clean(match[1])
  }
  return null
}

function extractDate(lines, labels, timeZone) {
  const matching = lines.find(line => new RegExp(`\\b(?:${labels.join('|')})\\b`, 'i').test(line))
  if (!matching) return field()
  const parsed = parseOpportunityDateFragment(matching, timeZone)
  if (parsed) return field(parsed, 0.92)
  if (/\b\d{1,2}\s+[A-Za-z]{3,9}\b/.test(matching)) return field(null, 0, ['A date was found without a safe year and was left blank.'])
  return field(null, 0, ['The referenced date could not be parsed safely.'])
}

function explicitOrganisation(text, lines) {
  const inviting = text.match(/(?:^|\n)(?:the\s+)?([A-Z][^\n.!?]{2,180}?\([A-Z][A-Z0-9&]{1,15}\))\s+invites?\s+you\b/im)?.[1]
  if (inviting) return clean(inviting)
  const invitingNamed = text.match(/(?:^|\n)(?:the\s+)?([A-Z][^\n.!?]{2,180}?\b(?:association|industries|club|society|university|institute|foundation|company|capital|bank|pte\.? ltd\.?|ltd\.?))\s+invites?\s+you\b/im)?.[1]
  if (invitingNamed) return clean(invitingNamed)
  const labelled = labeledLine(lines, ['organisation', 'organization', 'organiser', 'organizer', 'host', 'hosted by', 'organised by', 'organized by'])
  if (labelled) return labelled
  const presentedBy = clean(text.match(/\b(?:hosted|organised|organized|presented) by\s+([^\n,.]{2,180})/i)?.[1])
  if (presentedBy) return presentedBy
  const signoff = lines.findIndex(line => /^(?:best\s+)?regards|^sincerely/i.test(line))
  const signature = signoff >= 0 ? lines[signoff + 1] : null
  return signature && /\b(?:association|industries|club|society|university|institute|foundation|company|capital|bank|pte\.? ltd\.?|ltd\.?)\b/i.test(signature) ? signature : null
}

function explicitOpportunityTitle(text, fallback) {
  const numberedEvent = text.match(/\b\d+(?:st|nd|rd|th)\s+([A-Z][A-Za-z0-9&' -]{2,140}(?:Hackathon|Competition|Challenge)\s+20\d{2})\b/i)?.[1]
  const event = numberedEvent || text.match(/\b([A-Z][A-Za-z0-9&' -]{2,140}(?:Hackathon|Competition|Challenge)\s+20\d{2})\b/i)?.[1]
  return clean(event || fallback)
}

function explicitEligibility(lines) {
  const labelled = labeledLine(lines, ['eligibility', 'who can apply'])
  if (labelled) return labelled
  const statement = lines.find(line => /^(?:open to (?:all disciplines|all students|students from all years)|no prior experience required)[.!]?$/i.test(line))
  if (!statement) return null
  if (/^open to all disciplines/i.test(statement)) return 'Open to all disciplines'
  if (/^open to all students/i.test(statement)) return 'Open to all students'
  if (/^open to students from all years/i.test(statement)) return 'Open to students from all years'
  return 'No prior experience required'
}

function explicitRequirement(text, lines) {
  const labelled = labeledLine(lines, ['requirements?', 'you will need'])
  if (labelled) return labelled
  const team = text.match(/\bsign up as a team of\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i)?.[1]
  if (!team) return null
  const count = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }[team.toLowerCase()] || Number(team)
  return `Team of ${count}`
}

function explicitBenefit(text, lines) {
  const labelled = labeledLine(lines, ['benefits?', 'what you get'])
  if (labelled) return labelled
  const prize = text.match(/\bchampion team of each category\b[^.\n]{0,120}?\bSGD\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]
  if (!prize) return null
  const amount = Number(prize.replaceAll(',', ''))
  return Number.isFinite(amount) ? `SGD ${amount} cash prize for the champion team in each category` : null
}

function eventDateParts(line) {
  const match = line?.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(20\d{2})\b/i)
  return match ? { day: Number(match[1]), month: MONTHS[match[2].toLowerCase()], year: Number(match[3]) } : null
}

function clockParts(hour, minute, meridiem) {
  let hours = Number(hour)
  if (meridiem.toLowerCase() === 'pm' && hours < 12) hours += 12
  if (meridiem.toLowerCase() === 'am' && hours === 12) hours = 0
  return { hours, minutes: Number(minute || 0) }
}

function explicitEventRange(lines, timeZone) {
  const dateLine = lines.find(line => /^(?:event date|date)\s*[:–-]/i.test(line))
  const timeLine = lines.find(line => /^(?:event time|time)\s*[:–-]/i.test(line))
  const date = eventDateParts(dateLine)
  const range = timeLine?.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\s*[-–—]\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)
  if (!date || !range) return null
  const start = clockParts(range[1], range[2], range[3])
  const end = clockParts(range[4], range[5], range[6])
  return {
    startAt: dateFromParts(date.day, date.month, date.year, start.hours, start.minutes, timeZone),
    endAt: dateFromParts(date.day, date.month, date.year, end.hours, end.minutes, timeZone)
  }
}

export function extractOpportunityFromText(input, { timeZone = 'Asia/Singapore' } = {}) {
  const text = input.replace(/\r/g, '').trim()
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const urls = [...new Set((text.match(/https:\/\/[^\s<>()"']+/gi) || []).map(url => url.replace(/[.,;!?]+$/, '')))]
  const applicationUrl = urls.find(url => /apply|application|forms?\.|\/forms?(?:\/|$)|eventbrite|lu\.ma/i.test(url)) || null
  const sourceUrl = urls.find(url => url !== applicationUrl) || null
  const titleLine = labeledLine(lines, ['title', 'event', 'opportunity']) || lines.find(line => line.length >= 4 && line.length <= 180 && !/^https?:|^(deadline|apply|date|location|eligibility|requirements?|benefits?)\b/i.test(line))
  const title = explicitOpportunityTitle(text, titleLine)
  const organisation = explicitOrganisation(text, lines)
  const category = CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] || null
  const mode = /\bhybrid\b/i.test(text) ? 'HYBRID' : /\b(online|virtual|zoom|webinar)\b/i.test(text) ? 'ONLINE' : /\b(in[ -]?person|onsite|on-site)\b/i.test(text) ? 'IN_PERSON' : 'UNKNOWN'
  const location = labeledLine(lines, ['location', 'venue', 'where'])
  const eventRange = explicitEventRange(lines, timeZone)
  const eligibility = explicitEligibility(lines)
  const requirements = explicitRequirement(text, lines)
  const benefits = explicitBenefit(text, lines)
  const tags = CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([value]) => value.toLowerCase().replaceAll('_', '-')).slice(0, 12)
  const warnings = []
  if (!organisation) warnings.push('Organisation was not confidently identified.')
  if (!category) warnings.push('Category was not confidently identified.')

  return {
    candidate: {
      title: field(title, title ? 0.9 : 0, title ? [] : ['Title was not confidently identified.']),
      organisation: field(organisation, organisation ? 0.88 : 0, organisation ? [] : ['Review and add the organisation.']),
      category: field(category, category ? 0.86 : 0, category ? [] : ['Choose a category during review.']),
      description: field(),
      deadline: extractDate(lines, ['deadline', 'applications? close', 'closing date', 'apply by', 'submit by', 'respond by', 'complete by', 'due'], timeZone),
      startAt: eventRange ? field(eventRange.startAt, 0.95) : extractDate(lines, ['start date', 'starts', 'event date', 'date'], timeZone),
      endAt: eventRange ? field(eventRange.endAt, 0.95) : extractDate(lines, ['end date', 'ends'], timeZone),
      location: field(location, location ? 0.88 : 0),
      mode: field(mode, mode === 'UNKNOWN' ? 0.3 : 0.9, mode === 'UNKNOWN' ? ['Delivery mode was not explicit.'] : []),
      applicationUrl: field(applicationUrl, applicationUrl ? 0.9 : 0),
      sourceUrl: field(sourceUrl, sourceUrl ? 0.75 : 0),
      eligibilityText: field(eligibility, eligibility ? 0.9 : 0),
      requirements: field(requirements, requirements ? 0.9 : 0),
      benefits: field(benefits, benefits ? 0.9 : 0),
      tags: field(tags, tags.length ? 0.7 : 0)
    },
    warnings
  }
}
