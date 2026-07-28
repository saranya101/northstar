export const MAX_COURSE_OUTLINE_FILE_BYTES = 10 * 1024 * 1024
const SUPPORTED = new Map([
  ['application/pdf', 'PDF'],
  ['image/png', 'IMAGE'],
  ['image/jpeg', 'IMAGE'],
  ['image/webp', 'IMAGE'],
  ['text/plain', 'TEXT']
])

export function validateCourseOutlineFile(file) {
  if (!file || !SUPPORTED.has(file.type)) throw new Error('Choose a PDF, PNG, JPEG, WebP or plain-text file.')
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected file is empty.')
  if (file.size > MAX_COURSE_OUTLINE_FILE_BYTES) throw new Error('The file must be 10 MB or smaller.')
  return { sourceType: SUPPORTED.get(file.type), mimeType: file.type, size: file.size }
}
