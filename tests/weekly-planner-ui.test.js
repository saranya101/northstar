import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const read = relative => readFileSync(join(root, relative), 'utf8')

describe('weekly planner UI contract', () => {
  it('adds the authenticated planner page without modifying sidebar navigation', () => {
    const page = read('app/pages/app/planner.vue')
    expect(page).toContain("middleware: ['auth', 'onboarded']")
    expect(page).toContain('PlannerWeeklyCalendar')
    expect(page).toContain('PlannerStudyBlockModal')
  })

  it('uses isolated route CSS and browser-local storage', () => {
    expect(read('app/pages/app/planner.vue')).toContain("import '~/assets/css/planner.css'")
    expect(read('app/utils/planner-storage.client.js')).toContain('northstar:weekly-planner:user:')
    expect(read('app/utils/planner-storage.client.js')).toContain('PLANNER_STORAGE_VERSION')
  })

  it('renders all seven days, fixed classes and study-block actions', () => {
    const shared = read('shared/planner/weekly-planner.js')
    const calendar = read('app/components/planner/PlannerWeeklyCalendar.vue')
    expect(shared).toContain("'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'")
    expect(calendar).toContain('Fixed class')
    for (const action of ['Edit', 'Move', 'Complete', 'Skip', 'Focus', 'Delete']) expect(calendar).toContain(action)
  })

  it('requires explicit conflict acknowledgement and does not move blocks automatically', () => {
    const modal = read('app/components/planner/PlannerStudyBlockModal.vue')
    expect(modal).toContain('Save this block despite the overlap')
    expect(modal).toContain('Northstar will not move anything automatically.')
  })

  it('keeps planner styling mobile and reduced-motion safe', () => {
    const css = read('app/assets/css/planner.css')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(/min-height: 44px/)
  })
})
