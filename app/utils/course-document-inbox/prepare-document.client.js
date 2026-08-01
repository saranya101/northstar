import { extractCourseOutlineFile, sanitiseCourseOutlineText } from '~/utils/course-outline-import/extract-file.client'

async function sha256(value) {
  const bytes = value instanceof ArrayBuffer ? value : new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function prepareCourseDocumentFile(file, options = {}) {
  const [extracted, hash] = await Promise.all([
    extractCourseOutlineFile(file, options),
    file.arrayBuffer().then(sha256)
  ])
  return { ...extracted, sha256Hash: hash, fileSize: file.size, originalFileName: file.name }
}

export async function preparePastedCourseDocument(value) {
  const text = sanitiseCourseOutlineText(value)
  if (text.length < 20) throw new Error('Paste at least 20 characters to extract.')
  return { text, confidence: 1, sha256Hash: await sha256(text), fileSize: new TextEncoder().encode(text).byteLength, sourceType: 'TEXT', mimeType: 'text/plain' }
}
