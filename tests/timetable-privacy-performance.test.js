import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
describe('import privacy and bundle boundaries', () => {
  it('uses a text-only active timetable intake', () => {
    const page = readFileSync(join(root, 'app/pages/app/timetable/import/index.vue'), 'utf8')
    expect(page).toContain('Paste timetable text')
    expect(page).toContain('Text-only intake')
    expect(page).not.toMatch(/type="file"|accept=/)
  })
  it('sends only normalized candidates to the import API', () => {
    const page = readFileSync(join(root, 'app/pages/app/timetable/import/index.vue'), 'utf8')
    expect(page).toMatch(/createImport\(candidate\)/)
    expect(page).not.toMatch(/createImport\((?:file|extraction|pastedText)/)
    const service = readFileSync(join(root, 'server/services/timetable.js'), 'utf8')
    expect(service).not.toMatch(/rawOcr|fileBytes|matriculation|studentName/i)
  })
})
