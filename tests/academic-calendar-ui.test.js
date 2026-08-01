import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => readFileSync(join(root, relative), 'utf8')

describe('academic calendar page contract', () => {
  it('creates the authenticated calendar route without changing sidebar navigation', () => {
    const page = read('app/pages/app/calendar.vue')
    expect(page).toContain("definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })")
    expect(page).toContain('<CalendarMonth')
    expect(page).toContain('<CalendarAgenda')
    expect(page).toContain('Awaiting official date')
    expect(page).not.toContain('app/layouts/app.vue')
  })

  it('loads user data only through the existing authenticated composables', () => {
    const composable = read('app/composables/use-academic-calendar.js')
    expect(composable).toContain('useCurrentSession()')
    expect(composable).toContain('useModules()')
    expect(composable).toContain('useTimetable()')
    expect(composable).toContain('useAssessments()')
    expect(composable).not.toContain('$fetch')
    expect(composable).not.toContain('useFetch')
    expect(composable).not.toContain('/api/')
  })

  it('contains the required filters, navigation and export choices', () => {
    const toolbar = read('app/components/calendar/CalendarToolbar.vue')
    const exports = read('app/components/calendar/CalendarExportMenu.vue')
    expect(toolbar).toContain('Previous month')
    expect(toolbar).toContain('Next month')
    expect(toolbar).toContain('Today')
    expect(toolbar).toContain('All modules')
    expect(toolbar).toContain('All event types')
    expect(exports).toContain('All confirmed assessments')
    expect(exports).toContain('All confirmed exams')
    expect(exports).toContain('Selected module')
    expect(exports).toContain('Export timetable sessions')
  })

  it('provides required empty and partial-data states', () => {
    const page = read('app/pages/app/calendar.vue')
    expect(page).toContain('No confirmed calendar dates')
    expect(page).toContain('Exams are confirmed; no coursework dates have been recorded yet.')
    expect(page).toContain('Timetable sessions are available, but no confirmed assessment dates have been recorded.')
    expect(page).toContain('No events in selected month')
    expect(page).toContain('Calendar data that loaded successfully is still shown below.')
  })

  it('shows event details and one-event export', () => {
    const details = read('app/components/calendar/CalendarEventDetails.vue')
    expect(details).toContain('<dt>Module</dt>')
    expect(details).toContain('<dt>Date and time</dt>')
    expect(details).toContain('<dt>Weight</dt>')
    expect(details).toContain('<dt>Location</dt>')
    expect(details).toContain('<dt>Source status</dt>')
    expect(details).toContain('Export event')
  })

  it('keeps calendar styling isolated, responsive and reduced-motion safe', () => {
    const page = read('app/pages/app/calendar.vue')
    const css = read('app/assets/css/academic-calendar.css')
    expect(page).toContain("import '~/assets/css/academic-calendar.css'")
    expect(css).toMatch(/@media \(max-width: 800px\)/)
    expect(css).toMatch(/@media \(max-width: 600px\)/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(css).toContain('font-variant-numeric: tabular-nums')
  })
})
