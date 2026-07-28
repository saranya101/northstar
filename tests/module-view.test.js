import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { activeModuleCount, hasActiveModules } from '../app/utils/module-view'

describe('module page state', () => {
  it('shows the empty state only when there are no real module records', () => {
    expect(hasActiveModules(null)).toBe(false)
    expect(hasActiveModules({ modules: [] })).toBe(false)
    expect(hasActiveModules({ modules: [{ enrolmentId: 'e1' }] })).toBe(true)
  })

  it('uses the server-provided active module count', () => {
    expect(activeModuleCount({ activeCount: 3 })).toBe(3)
    expect(activeModuleCount(null)).toBe(0)
  })

  it('refreshes module and timetable caches after confirmation and on module-page entry', () => {
    const root = new URL('..', import.meta.url).pathname
    const timetableComposable = readFileSync(join(root, 'app/composables/use-timetable.js'), 'utf8')
    const modulesPage = readFileSync(join(root, 'app/pages/app/modules/index.vue'), 'utf8')
    expect(timetableComposable).toMatch(/const \{ clear: clearModules, load: loadModules \} = useModules\(\)/)
    expect(timetableComposable).toMatch(/clearModules\(\)[\s\S]*Promise\.allSettled\(\[load\(true\), loadModules\(true\)\]\)/)
    expect(modulesPage).toMatch(/if \(currentUser\) void load\(true\)/)
    expect(modulesPage).toMatch(/v-else-if="!hasModules"/)
  })

  it('shows imported enrolment and session facts on module cards', () => {
    const root = new URL('..', import.meta.url).pathname
    const card = readFileSync(join(root, 'app/components/modules/ModuleCard.vue'), 'utf8')
    expect(card).toMatch(/module\.indexNumber/)
    expect(card).toMatch(/module\.registrationStatus/)
    expect(card).toMatch(/module\.sessionCount/)
    expect(card).toMatch(/\/app\/modules\/\$\{module\.enrolmentId\}/)
  })
})
