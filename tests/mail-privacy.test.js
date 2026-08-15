import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('mail intake privacy boundaries', () => {
  it('contains no credential fields, external provider calls, or raw-body logging', () => {
    const root = new URL('..', import.meta.url).pathname
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const intelligence = readFileSync(join(root, 'server/services/mail-intelligence.js'), 'utf8')
    const service = readFileSync(join(root, 'server/services/mail-intakes.js'), 'utf8')
    const model = schema.match(/model MailIntake \{[\s\S]*?\n\}/)?.[0] || ''
    expect(model).not.toMatch(/password|token|cookie|session/i)
    expect(`${intelligence}\n${service}`).not.toMatch(/console\.(log|info|debug)|fetch\(|\$fetch\(/)
  })
})
