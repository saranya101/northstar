import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const read = path => readFileSync(join(root, path), 'utf8')

describe('academic frontend workflow', () => {
  it('adds accessible module navigation, assessment, documents and course outline sections', () => {
    const page = read('app/pages/app/modules/[id].vue')
    expect(page).toContain('aria-label="Module sections"')
    expect(page).toContain('<AcademicAssessmentsPanel')
    expect(page).toContain('<AcademicDocumentsInboxPanel')
    expect(page).toContain('<AcademicCourseOutlinePanel')
  })

  it('provides a source-aware document inbox without claiming original-file retention', () => {
    const panel = read('app/components/academic/DocumentsInboxPanel.vue')
    expect(panel).toContain('Course Document Inbox')
    expect(panel).toContain('Original files are processed locally and are not retained')
    expect(panel).toContain('Duplicate upload')
    expect(panel).toContain('Open review')
    expect(panel).toContain('Archive')
  })

  it('shows side-by-side proposal evidence and requires explicit review', () => {
    const review = read('app/pages/app/course-documents/[id].vue')
    expect(review).toContain('Current value')
    expect(review).toContain('Proposed value')
    expect(review).toContain('Source evidence')
    expect(review).toContain('Approve all non-conflicting')
    expect(review).toContain("item.classification !== 'CONFLICT'")
    expect(review).toContain("return 'Awaiting details'")
    expect(review).toContain("return 'Needs review'")
    expect(review).toContain('Reject')
  })

  it('states that extraction is review-first and the original is not retained', () => {
    const panel = read('app/components/academic/CourseOutlinePanel.vue')
    expect(panel).toContain('Nothing becomes a confirmed assessment until you approve it.')
    expect(panel).toContain('not the original file')
    expect(panel).toContain('aria-label="Course outline source"')
  })

  it('supports selection, rejection, manual candidates and resume-safe saves', () => {
    const review = read('app/pages/app/course-outline-imports/[id].vue')
    expect(review).toContain('Add missing assessment')
    expect(review).toContain("'REJECTED'")
    expect(review).toContain('Save and return later')
    expect(review).toContain('Confirm selected assessments')
    expect(review).toContain('confidence')
  })

  it('shows grade assumptions and keeps scenarios temporary', () => {
    const panel = read('app/components/academic/AssessmentsPanel.vue')
    expect(panel).toContain('Hypothetical scenarios')
    expect(panel).toContain('never overwrite confirmed scores')
    expect(panel).toContain('not official grade boundaries')
    expect(panel).toContain('Reset scenarios')
  })

  it('provides workspace empty/provenance and accessible item controls', () => {
    const workspace = read('app/pages/app/assessments/[id].vue')
    expect(workspace).toContain('Source trail')
    expect(workspace).toContain('This assessment was entered manually.')
    expect(workspace).toContain('aria-label="Delete deliverable"')
    expect(workspace).toContain('aria-label="Milestone status"')
  })

  it('contains tablet/mobile academic layouts', () => {
    const css = read('app/assets/css/main.css')
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*\.workspace-grid/)
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.review-actions/)
  })
})
