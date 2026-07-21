import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { validateOpportunityFile, MAX_OPPORTUNITY_FILE_BYTES } from '../app/utils/opportunity-import/file-validation'
import { sanitiseOpportunityCandidate, sanitiseOpportunityText } from '../app/utils/opportunity-import/text-sanitizer'
import { extractOpportunityPdf } from '../app/utils/opportunity-import/pdf-extractor.client'
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
    expect(createExtractor).not.toHaveBeenCalled()
    expect(page.cleanup).toHaveBeenCalledOnce()
    expect(pdf.destroy).toHaveBeenCalledOnce()
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
