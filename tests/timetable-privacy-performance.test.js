import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
describe('import privacy and bundle boundaries', () => {
  it('loads OCR and PDF libraries dynamically only in client extractors', () => {
    const ocr = readFileSync(join(root, 'app/utils/timetable-import/ocr-extractor.client.js'), 'utf8')
    const pdf = readFileSync(join(root, 'app/utils/timetable-import/pdf-extractor.client.js'), 'utf8')
    expect(ocr).toMatch(/await import\('tesseract\.js'\)/)
    expect(pdf).toMatch(/await import\('pdfjs-dist\/build\/pdf\.mjs'\)/)
  })
  it('never sends original file bytes or raw OCR text to the import API', () => {
    const page = readFileSync(join(root, 'app/pages/app/timetable/import/index.vue'), 'utf8')
    expect(page).toMatch(/createImport\(candidate\)/)
    expect(page).not.toMatch(/createImport\((?:file|extraction|pastedText)/)
    const service = readFileSync(join(root, 'server/services/timetable.js'), 'utf8')
    expect(service).not.toMatch(/rawOcr|fileBytes|matriculation|studentName/i)
  })
})
