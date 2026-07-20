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

const files = sourceFiles(appRoot)

describe('Nuxt composable context safety', () => {
  it('mounts exactly one UApp provider at the application root', () => {
    const roots = files.flatMap((path) => readFileSync(path, 'utf8').match(/<UApp\b/g) || [])
    expect(roots).toHaveLength(1)
    expect(readFileSync(join(appRoot, 'app.vue'), 'utf8')).toMatch(/<UApp\b/)
  })

  it('does not import application head composables directly from Unhead', () => {
    for (const path of files) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/from\s+['"](?:@unhead\/vue|unhead)['"]/)
    }
  })

  it('keeps custom composable factories synchronous', () => {
    for (const path of files.filter(path => path.includes('/composables/'))) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/export\s+async\s+function\s+use[A-Z]/)
    }
  })

  it('does not initialise setup composables or watchers after a top-level await', () => {
    for (const path of files.filter(path => path.endsWith('.vue'))) {
      const source = readFileSync(path, 'utf8')
      const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1] || ''
      const awaitIndex = script.search(/^await\b/m)
      if (awaitIndex === -1) continue

      const afterAwait = script.slice(awaitIndex)
      expect(afterAwait, path).not.toMatch(/^(?:const|let)\s+\w+\s*=.*\b(?:computed|reactive|ref|use[A-Z]\w*)\s*\(/m)
      expect(afterAwait, path).not.toMatch(/^watch(?:Effect)?\s*\(/m)
      expect(afterAwait, path).not.toMatch(/^use(?:Head|SeoMeta|HeadSafe)\s*\(/m)
    }
  })

  it('captures middleware composables before the first await', () => {
    for (const path of files.filter(path => path.includes('/middleware/'))) {
      const source = readFileSync(path, 'utf8')
      const awaitIndex = source.indexOf('await ')
      if (awaitIndex === -1) continue
      const afterAwait = source.slice(awaitIndex)
      expect(afterAwait, path).not.toMatch(/\buse(?:NuxtApp|CurrentSession|Onboarding|Modules|Route|Router)\s*\(/)
    }
  })
})
