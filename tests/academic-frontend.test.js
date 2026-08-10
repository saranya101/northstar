import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const read = path => readFileSync(join(root, path), 'utf8')

describe('Northstar V2 academic frontend', () => {
  it('uses compact dossier sections without document ingestion panels', () => {
    const page = read('app/pages/app/modules/[id].vue')
    expect(page).toContain('aria-label="Module sections"')
    for (const section of ['Overview', 'Assessments', 'Coursework', 'Tasks', 'Schedule', 'Grades']) expect(page).toContain(section)
    expect(page).toContain('<AcademicAssessmentsPanel')
    expect(page).not.toContain('DocumentsInboxPanel')
    expect(page).not.toContain('CourseOutlinePanel')
  })

  it('provides text intake and explicit proposal decisions', () => {
    const inbox = read('app/pages/app/inbox.vue')
    expect(inbox).toContain('Paste once. Review before anything changes.')
    expect(inbox).toContain('Module context')
    expect(inbox).toContain('Approve')
    expect(inbox).toContain('Dismiss')
    expect(inbox).toContain('Text is retained as evidence')
  })

  it('removes legacy document routes and active upload controls', () => {
    expect(existsSync(join(root, 'app/pages/app/course-documents/[id].vue'))).toBe(false)
    expect(existsSync(join(root, 'app/pages/app/course-outline-imports/[id].vue'))).toBe(false)
    expect(read('app/pages/app/timetable/import/index.vue')).not.toMatch(/type="file"|accept=/)
    expect(read('app/pages/app/opportunities/new.vue')).not.toMatch(/type="file"|accept=/)
  })

  it('keeps grade assumptions and temporary scenarios explicit', () => {
    const panel = read('app/components/academic/AssessmentsPanel.vue')
    expect(panel).toContain('never overwrite confirmed scores')
    expect(panel).toContain('not official grade boundaries')
  })

  it('contains compact responsive shell rules', () => {
    const css = read('app/assets/css/v2.css')
    expect(css).toMatch(/@media\s*\(max-width:\s*900px\)/)
    expect(css).toContain('.v2-workspace{min-width:0}')
  })

  it('offers an explicit browser-local Planner and Focus reset', () => {
    const settings = read('app/pages/app/settings.vue')
    expect(settings).toContain('Clear local study data')
    expect(settings).toContain('createPlannerStorage().removeUserData')
    expect(settings).toContain('createFocusStorage().removeUserData')
    expect(settings).toContain('globalThis.confirm')
  })
})
