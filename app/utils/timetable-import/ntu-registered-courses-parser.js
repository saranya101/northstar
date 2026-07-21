import { parseTimetableText } from './timetable-text-parser'

export function parseNtuRegisteredCourses(text, source = 'PASTED_TEXT') {
  return parseTimetableText(text, source)
}

