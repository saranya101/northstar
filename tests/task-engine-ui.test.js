import { readFileSync } from 'node:fs'; import { describe, expect, it } from 'vitest'
const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')
describe('task engine UI contract', () => {
  it('adds an authenticated task route without a sidebar item', () => { const page = read('app/pages/app/tasks.vue'); expect(page).toContain("middleware: ['auth', 'onboarded']"); expect(read('app/layouts/app.vue')).not.toContain("label: 'Tasks'") })
  it('provides required views, actions and local-time disclosure', () => { const page = read('app/pages/app/tasks.vue'); for (const value of ['TODAY','OVERDUE','UPCOMING','BACKLOG','COMPLETED','ALL']) expect(page).toContain(value); for (const action of ['Start Focus','Reschedule','Split','Cancel','Delete']) expect(page).toContain(action); expect(page).toContain('Recorded on this device') })
  it('adds source create/open actions without coupling completion', () => { expect(read('app/pages/app/recurring-coursework/[id].vue')).toContain("'Open task' : 'Create task'"); expect(read('app/pages/app/assessments/[id].vue')).toContain("'Open task' : 'Create task'"); expect(read('server/services/tasks.js')).not.toContain('recurringCourseworkOccurrence.update'); expect(read('server/services/tasks.js')).not.toContain('assessment.update') })
  it('keeps task styles isolated and mobile', () => { const css = read('app/assets/css/tasks.css'); expect(css).toContain('@media(max-width:680px)'); expect(read('app/pages/app/tasks.vue')).toContain("import '~/assets/css/tasks.css'") })
})
