export const MAX_OPPORTUNITY_FILE_BYTES = 10 * 1024 * 1024
export const MAX_OPPORTUNITY_PDF_PAGES = 10

const SUPPORTED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export function validateOpportunityFile(file) {
  if (!file || !SUPPORTED_TYPES.has(file.type)) throw new Error('Choose a PNG, JPEG, WebP or PDF file.')
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected file is empty.')
  if (file.size > MAX_OPPORTUNITY_FILE_BYTES) throw new Error('The file must be 10 MB or smaller.')
  return { kind: file.type === 'application/pdf' ? 'pdf' : 'image', type: file.type, size: file.size }
}
