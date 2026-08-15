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
  match = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(20\d{2})(?:\s*(?:,|at)?\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?)?\b/i)
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

function section(lines, labels) {
  const value = labeledLine(lines, labels)
  return value ? field(value, 0.82) : field()
}

export function extractOpportunityFromText(input, { timeZone = 'Asia/Singapore' } = {}) {
  const text = input.replace(/\r/g, '').trim()
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const urls = [...new Set((text.match(/https:\/\/[^\s<>()"']+/gi) || []).map(url => url.replace(/[.,;!?]+$/, '')))]
  const applicationUrl = urls.find(url => /apply|application|forms?\.|\/forms?(?:\/|$)|eventbrite|lu\.ma/i.test(url)) || null
  const sourceUrl = urls.find(url => url !== applicationUrl) || null
  const titleLine = labeledLine(lines, ['title', 'event', 'opportunity']) || lines.find(line => line.length >= 4 && line.length <= 180 && !/^https?:|^(deadline|apply|date|location|eligibility|requirements?|benefits?)\b/i.test(line))
  const organisation = labeledLine(lines, ['organisation', 'organization', 'organiser', 'organizer', 'host', 'hosted by', 'organised by', 'organized by'])
    || clean(text.match(/\b(?:hosted|organised|organized|presented) by\s+([^\n,.]{2,180})/i)?.[1])
  const category = CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] || null
  const mode = /\bhybrid\b/i.test(text) ? 'HYBRID' : /\b(online|virtual|zoom|webinar)\b/i.test(text) ? 'ONLINE' : /\b(in[ -]?person|onsite|on-site)\b/i.test(text) ? 'IN_PERSON' : 'UNKNOWN'
  const location = labeledLine(lines, ['location', 'venue', 'where'])
  const tags = CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([value]) => value.toLowerCase().replaceAll('_', '-')).slice(0, 12)
  const warnings = []
  if (!organisation) warnings.push('Organisation was not confidently identified.')
  if (!category) warnings.push('Category was not confidently identified.')

  return {
    candidate: {
      title: field(clean(titleLine), titleLine ? 0.72 : 0, titleLine ? [] : ['Title was not confidently identified.']),
      organisation: field(organisation, organisation ? 0.88 : 0, organisation ? [] : ['Review and add the organisation.']),
      category: field(category, category ? 0.86 : 0, category ? [] : ['Choose a category during review.']),
      description: field(),
      deadline: extractDate(lines, ['deadline', 'applications? close', 'closing date', 'apply by', 'submit by', 'respond by', 'complete by', 'due'], timeZone),
      startAt: extractDate(lines, ['start date', 'starts', 'event date', 'date'], timeZone),
      endAt: extractDate(lines, ['end date', 'ends'], timeZone),
      location: field(location, location ? 0.88 : 0),
      mode: field(mode, mode === 'UNKNOWN' ? 0.3 : 0.9, mode === 'UNKNOWN' ? ['Delivery mode was not explicit.'] : []),
      applicationUrl: field(applicationUrl, applicationUrl ? 0.9 : 0),
      sourceUrl: field(sourceUrl, sourceUrl ? 0.75 : 0),
      eligibilityText: section(lines, ['eligibility', 'who can apply']),
      requirements: section(lines, ['requirements?', 'you will need']),
      benefits: section(lines, ['benefits?', 'what you get']),
      tags: field(tags, tags.length ? 0.7 : 0)
    },
    warnings
  }
}
