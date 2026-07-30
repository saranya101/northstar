import { validateCourseOutlineFile } from './file-validation'

const LAYOUT_START = '[[COURSE_OUTLINE_LAYOUT_V1]]'
const LAYOUT_END = '[[/COURSE_OUTLINE_LAYOUT_V1]]'

function sanitise(value) {
  return String(value || '')
    .replace(/\0|\f|\u200B|\u200C|\u200D/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n')
    .trim()
    .slice(0, 100_000)
}

function withLayout(text, layout) {
  if (!Array.isArray(layout) || !layout.some(page => page.items?.length)) return text
  const payload = JSON.stringify(layout)
  const suffix = `\n${LAYOUT_START}\n${payload}\n${LAYOUT_END}`
  return suffix.length < 80_000 ? `${text.slice(0, 100_000 - suffix.length)}${suffix}` : text
}

export async function extractCourseOutlineFile(file, options = {}) {
  const metadata = validateCourseOutlineFile(file)
  let extraction
  if (metadata.sourceType === 'TEXT') {
    extraction = { text: await file.text(), confidence: 1, usedOcr: false }
  } else if (metadata.sourceType === 'PDF') {
    extraction = await (await import('../opportunity-import/pdf-extractor.client')).extractOpportunityPdf(file, { ...options, includeLayout: true })
  } else {
    extraction = await (await import('../opportunity-import/image-extractor.client')).extractOpportunityImage(file, options)
  }
  if (options.signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
  const text = withLayout(sanitise(extraction.text), extraction.layout)
  if (text.length < 20) throw new Error('Not enough course-outline text could be read. Try a clearer file or paste the text instead.')
  return { ...metadata, ...extraction, text }
}

export function sanitiseCourseOutlineText(value) {
  return sanitise(value)
}
