import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const appRoot = join(root, 'app')

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  }).filter(path => ['.js', '.vue'].includes(extname(path)))
}

describe('authenticated application performance boundaries', () => {
  it('keeps public pages SSR-rendered and private routes client-rendered', () => {
    const config = readFileSync(join(root, 'nuxt.config.ts'), 'utf8')
    expect(config).toMatch(/'\/app':\s*\{\s*ssr:\s*false\s*\}/)
    expect(config).toMatch(/'\/app\/\*\*':\s*\{\s*ssr:\s*false\s*\}/)
    for (const route of ['onboarding', 'login', 'signup']) {
      expect(config).toMatch(new RegExp(`'/${route}':\\s*\\{\\s*ssr:\\s*false\\s*\\}`))
    }
    expect(config).not.toMatch(/'\/':\s*\{\s*ssr:\s*false\s*\}/)
    expect(config).toMatch(/process\.env\.NUXT_DEVTOOLS\s*===\s*'true'/)
  })

  it('does not force document navigation for internal application routes', () => {
    for (const path of sourceFiles(appRoot)) {
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/<a\b[^>]*href=["']\//)
      expect(source, path).not.toMatch(/(?:window\.)?location\.(?:href|assign|replace)\b/)
    }

    const layout = readFileSync(join(appRoot, 'layouts/app.vue'), 'utf8')
    expect(layout.match(/<NuxtLink\b/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('does not block private page setup on top-level data awaits', () => {
    const pages = [
      'pages/app/index.vue',
      'pages/app/modules/index.vue',
      'pages/app/modules/[id].vue',
      'pages/app/settings.vue',
      'pages/onboarding/index.vue'
    ]
    for (const page of pages) {
      const source = readFileSync(join(appRoot, page), 'utf8')
      const setup = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1] || ''
      expect(setup, page).not.toMatch(/^await\s+(?:load|loadModules|loadDossier)/m)
    }
  })

  it('describes saved modules honestly and defaults to manual entry', () => {
    const modal = readFileSync(join(appRoot, 'components/modules/AddModuleModal.vue'), 'utf8')
    expect(modal).toContain('Search modules already saved in Northstar or add your module manually.')
    expect(modal).toContain('Search saved modules')
    expect(modal).toContain('Official university catalogue import will be added separately.')
    expect(modal).toContain('No saved modules match this search yet.')
    expect(modal).toMatch(/const mode = ref\('manual'\)/)
    expect(modal).not.toContain('shared catalogue module')
  })

  it('debounces search, requires two characters and ignores stale responses', () => {
    const modal = readFileSync(join(appRoot, 'components/modules/AddModuleModal.vue'), 'utf8')
    const composable = readFileSync(join(appRoot, 'composables/use-modules.js'), 'utf8')
    expect(modal).toMatch(/currentMode !== 'search' \|\| value\.trim\(\)\.length < 2/)
    expect(modal).toMatch(/setTimeout\(\(\) => search\(value\), 280\)/)
    expect(composable).toMatch(/query\.length < 2/)
    expect(composable).toMatch(/sequence === nuxtApp\[MODULE_SEARCH_SEQUENCE\]/)
    expect(composable).toMatch(/MODULE_SEARCH_CACHE/)
  })
})
