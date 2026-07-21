export const MAX_TIMETABLE_FILE_BYTES = 10 * 1024 * 1024
export const MAX_TIMETABLE_PDF_PAGES = 10
const MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export function validateTimetableFile(file) {
  if (!file || !MIME_TYPES.has(file.type)) throw new Error('Choose a PDF, PNG, JPEG or WebP file.')
  if (file.size > MAX_TIMETABLE_FILE_BYTES) throw new Error('The file must be 10 MB or smaller.')
  return { type: file.type, size: file.size }
}

