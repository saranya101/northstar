import { validateCourseOutlineFile } from './file-validation'

function sanitise(value) {
  return String(value || '')
    .replace(/\0|\f|\u200B|\u200C|\u200D/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n')
    .trim()
    .slice(0, 100_000)
}

export async function extractCourseOutlineFile(file, options = {}) {
  const metadata = validateCourseOutlineFile(file)
  let extraction
  if (metadata.sourceType === 'TEXT') {
    extraction = { text: await file.text(), confidence: 1, usedOcr: false }
  } else if (metadata.sourceType === 'PDF') {
    extraction = await (await import('../opportunity-import/pdf-extractor.client')).extractOpportunityPdf(file, options)
  } else {
    extraction = await (await import('../opportunity-import/image-extractor.client')).extractOpportunityImage(file, options)
  }
  if (options.signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError')
  const text = sanitise(extraction.text)
  if (text.length < 20) throw new Error('Not enough course-outline text could be read. Try a clearer file or paste the text instead.')
  return { ...metadata, ...extraction, text }
}

export function sanitiseCourseOutlineText(value) {
  return sanitise(value)
}
