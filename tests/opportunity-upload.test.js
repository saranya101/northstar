import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { validateOpportunityFile, MAX_OPPORTUNITY_FILE_BYTES } from '../app/utils/opportunity-import/file-validation'
import { sanitiseOpportunityCandidate, sanitiseOpportunityText } from '../app/utils/opportunity-import/text-sanitizer'
import { extractOpportunityPdf } from '../app/utils/opportunity-import/pdf-extractor.client'
import { extractCourseOutlineFile } from '../app/utils/course-outline-import/extract-file.client'
import { extractOpportunityFromText } from '../server/services/opportunity-text-parser'
import { parseOpportunityTextSchema } from '../shared/schemas/opportunities'

const root = new URL('..', import.meta.url).pathname
const file = (type = 'application/pdf', size = 100) => ({ type, size, arrayBuffer: async () => new ArrayBuffer(size) })
const textItem = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] })

function pdfDocument(page) {
  return { numPages: 1, getPage: vi.fn().mockResolvedValue(page), destroy: vi.fn().mockResolvedValue() }
}

describe('opportunity browser upload', () => {
  it('validates image and PDF types and file sizes', () => {
    expect(validateOpportunityFile(file('image/png')).kind).toBe('image')
    expect(validateOpportunityFile(file('image/jpeg')).kind).toBe('image')
    expect(validateOpportunityFile(file('image/webp')).kind).toBe('image')
    expect(validateOpportunityFile(file()).kind).toBe('pdf')
    expect(() => validateOpportunityFile(file('text/plain'))).toThrow(/PNG, JPEG, WebP or PDF/)
    expect(() => validateOpportunityFile(file('image/png', MAX_OPPORTUNITY_FILE_BYTES + 1))).toThrow(/10 MB or smaller/)
  })

  it('uses embedded PDF text without loading OCR', async () => {
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [textItem('Software Engineering Internship', 10, 20), textItem('Organisation: Example Labs', 10, 10)] }), cleanup: vi.fn(), getViewport: vi.fn(), render: vi.fn() }
    const pdf = pdfDocument(page)
    const createExtractor = vi.fn()
    const result = await extractOpportunityPdf(file(), { loadPdf: async () => pdf, createExtractor })
    expect(result.text).toContain('Software Engineering Internship')
    expect(result.usedOcr).toBe(false)
    expect(result).not.toHaveProperty('layout')
    expect(createExtractor).not.toHaveBeenCalled()
    expect(page.cleanup).toHaveBeenCalledOnce()
    expect(pdf.destroy).toHaveBeenCalledOnce()
  })

  it('keeps a local wipeable copy when PDF.js detaches its worker data', async () => {
    const originalBuffer = Uint8Array.from([11, 22, 33, 44]).buffer
    const localFile = { type: 'application/pdf', size: 4, arrayBuffer: async () => originalBuffer }
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [textItem('A sufficiently long embedded PDF course outline for safe extraction', 10, 20)] }), cleanup: vi.fn() }
    const pdf = pdfDocument(page)
    let workerData
    const result = await extractOpportunityPdf(localFile, {
      loadPdf: async (data) => {
        workerData = data
        structuredClone(data.buffer, { transfer: [data.buffer] })
        return pdf
      }
    })

    expect(result.text).toContain('course outline')
    expect(workerData.byteLength).toBe(0)
    expect([...new Uint8Array(originalBuffer)]).toEqual([0, 0, 0, 0])
    expect(pdf.destroy).toHaveBeenCalledOnce()
  })

  it('does not let document cleanup failure hide successful extraction', async () => {
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [textItem('A sufficiently long embedded PDF opportunity description', 10, 20)] }), cleanup: vi.fn() }
    const pdf = { ...pdfDocument(page), destroy: vi.fn().mockRejectedValue(new Error('cleanup failed')) }
    await expect(extractOpportunityPdf(file(), { loadPdf: async () => pdf })).resolves.toMatchObject({
      text: expect.stringContaining('opportunity description'), usedOcr: false
    })
  })

  it('returns safe errors for malformed and empty PDFs', async () => {
    const malformed = Object.assign(new Error('internal parser detail'), { name: 'InvalidPDFException' })
    const loadingTask = { promise: Promise.reject(malformed), destroy: vi.fn().mockRejectedValue(new Error('cleanup failed')) }
    await expect(extractOpportunityPdf(file(), { loadPdf: async () => loadingTask })).rejects.toThrow('This PDF could not be read. Try exporting it again or use a screenshot.')
    expect(loadingTask.destroy).toHaveBeenCalledOnce()

    const empty = { numPages: 0, destroy: vi.fn().mockResolvedValue() }
    await expect(extractOpportunityPdf(file(), { loadPdf: async () => empty })).rejects.toThrow('The PDF contains no readable pages.')
    expect(empty.destroy).toHaveBeenCalledOnce()
  })

  it('returns the established password error and preserves the primary extraction error', async () => {
    const passwordError = Object.assign(new Error('password required'), { name: 'PasswordException' })
    await expect(extractOpportunityPdf(file(), { loadPdf: async () => { throw passwordError } })).rejects.toThrow('Encrypted PDFs are not supported. Export an unlocked copy or use a screenshot.')

    const page = { getTextContent: vi.fn().mockRejectedValue(new Error('page extraction failed')), cleanup: vi.fn(() => { throw new Error('page cleanup failed') }) }
    const pdf = { ...pdfDocument(page), destroy: vi.fn().mockRejectedValue(new Error('document cleanup failed')) }
    await expect(extractOpportunityPdf(file(), { loadPdf: async () => pdf })).rejects.toThrow('page extraction failed')
  })

  it('supports consecutive imports and retrying the same file after failure', async () => {
    const page = () => ({ getTextContent: vi.fn().mockResolvedValue({ items: [textItem('A sufficiently long reusable PDF course outline description', 10, 20)] }), cleanup: vi.fn() })
    const reusableFile = { type: 'application/pdf', size: 4, arrayBuffer: vi.fn().mockImplementation(async () => Uint8Array.from([1, 2, 3, 4]).buffer) }
    const firstPdf = pdfDocument(page())
    const secondPdf = pdfDocument(page())
    await expect(extractOpportunityPdf(reusableFile, { loadPdf: async () => firstPdf })).resolves.toMatchObject({ usedOcr: false })
    await expect(extractOpportunityPdf(reusableFile, { loadPdf: async () => secondPdf })).resolves.toMatchObject({ usedOcr: false })

    const malformed = Object.assign(new Error('bad PDF'), { name: 'InvalidPDFException' })
    let attempts = 0
    const retryLoader = async () => {
      attempts += 1
      if (attempts === 1) throw malformed
      return pdfDocument(page())
    }
    await expect(extractOpportunityPdf(reusableFile, { loadPdf: retryLoader })).rejects.toThrow('This PDF could not be read')
    await expect(extractOpportunityPdf(reusableFile, { loadPdf: retryLoader })).resolves.toMatchObject({ text: expect.stringContaining('course outline') })
    expect(reusableFile.arrayBuffer).toHaveBeenCalledTimes(4)
  })

  it('preserves the course-outline extraction contract after PDF cleanup', async () => {
    const layoutItem = { ...textItem('Quiz 20%\\nProject 40%\\nFinal Examination 40%', 10, 20), width: 220 }
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [layoutItem] }), cleanup: vi.fn() }
    const result = await extractCourseOutlineFile(file(), { loadPdf: async () => pdfDocument(page) })
    expect(result).toMatchObject({ sourceType: 'PDF', usedOcr: false })
    expect(result.text).toContain('Final Examination 40%')
    expect(result.text).toContain('[[COURSE_OUTLINE_LAYOUT_V1]]')
    expect(result.layout[0]).toMatchObject({ pageNumber: 1, items: [{ text: layoutItem.str, x: 10, y: 20, width: 220 }] })
  })

  it('falls back to OCR only for a scanned PDF page and disposes resources', async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }))
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [] }), cleanup: vi.fn(), getViewport: vi.fn(() => ({ width: 100, height: 140 })), render }
    const pdf = pdfDocument(page)
    const terminate = vi.fn().mockResolvedValue()
    const recognise = vi.fn().mockResolvedValue({ text: 'Hackathon\nOrganisation: Example Labs\nDeadline: 12 August 2026', words: [] })
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({})) }
    const result = await extractOpportunityPdf(file(), { loadPdf: async () => pdf, createExtractor: async () => ({ recognise, terminate }), createCanvas: () => canvas })
    expect(result.usedOcr).toBe(true)
    expect(recognise).toHaveBeenCalledOnce()
    expect(terminate).toHaveBeenCalledOnce()
    expect(page.cleanup).toHaveBeenCalledOnce()
    expect(pdf.destroy).toHaveBeenCalledOnce()
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })

  it('filters identity headers and email addresses before parsing', () => {
    const text = sanitiseOpportunityText('Student Name: Raja Latchiya Dhurga\nstudent@example.edu\nBuild for Good Hackathon\nOrganisation: Example Labs\nEligibility: NTU students')
    expect(text).not.toMatch(/Raja|student@example|Student Name/i)
    const result = extractOpportunityFromText(text)
    expect(result.candidate.title.value).toBe('Build for Good Hackathon')
    expect(result.candidate.organisation.value).toBe('Example Labs')
  })

  it('removes email-bearing candidate fields and leaves uncertain fields null', () => {
    const parsed = extractOpportunityFromText('Hackathon applications are open\nApplications close 12 August\nContact: student@example.edu')
    const sanitised = sanitiseOpportunityCandidate({ candidate: { ...parsed.candidate, organisation: { value: 'student@example.edu', confidence: .8, warnings: [] } }, warnings: [] })
    expect(sanitised.candidate.organisation.value).toBeNull()
    expect(parsed.candidate.deadline.value).toBeNull()
  })

  it('cleans up a PDF when extraction is cancelled', async () => {
    const controller = new AbortController(); controller.abort()
    const page = { cleanup: vi.fn() }
    const pdf = pdfDocument(page)
    await expect(extractOpportunityPdf(file(), { signal: controller.signal, loadPdf: async () => pdf })).rejects.toMatchObject({ name: 'AbortError' })
    expect(pdf.destroy).toHaveBeenCalledOnce()
    expect(page.cleanup).not.toHaveBeenCalled()
  })

  it('sends only sanitised text to the strict parser API and reviews before save', () => {
    expect(parseOpportunityTextSchema.safeParse({ text: 'A sufficiently long opportunity announcement.', fileBytes: 'raw-data' }).success).toBe(false)
    const page = readFileSync(join(root, 'app/pages/app/opportunities/new.vue'), 'utf8')
    expect(page).toMatch(/const parsed = await parseText\(local\.text\)/)
    expect(page).not.toMatch(/parseText\((?:uploadFile|file|local)\.value/)
    expect(page).toMatch(/<OpportunitiesOpportunityForm[\s\S]*submit-label="Confirm and save"/)
    expect(page).toContain('Nothing is saved automatically.')
    expect(page).toContain('Cancel extraction')
  })

  it('keeps upload controls mobile-safe at 390 by 844', () => {
    const css = readFileSync(join(root, 'app/assets/css/main.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.opportunity-tabs button \{ min-width: 0;/)
    expect(css).toMatch(/\.upload-picker input \{ width: 100%; min-height: 48px;/)
    expect(css).toMatch(/\.upload-progress button \{ min-height: 44px;/)
  })
})
