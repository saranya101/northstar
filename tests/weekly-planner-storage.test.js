import { describe, expect, it } from 'vitest'
import { createPlannerStorage } from '../app/utils/planner-storage.client.js'

function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), keys: () => [...values.keys()] }
}

const input = { title: 'Accounting practice', date: '2026-08-10', startMinutes: 540, endMinutes: 600, status: 'PLANNED' }
function planner(local) { return createPlannerStorage(local, { idFactory: () => 'block-1', now: () => new Date('2026-08-01T00:00:00.000Z') }) }

describe('weekly planner local storage', () => {
  it('scopes blocks by authenticated user ID', () => {
    const local = memoryStorage(); const storage = planner(local)
    storage.create('user-1', input); storage.create('user-2', { ...input, title: 'Other user' })
    expect(storage.load('user-1').blocks[0].title).toBe('Accounting practice')
    expect(storage.load('user-2').blocks[0].title).toBe('Other user')
    expect(local.keys()).toEqual(expect.arrayContaining(['northstar:weekly-planner:user:user-1', 'northstar:weekly-planner:user:user-2']))
  })

  it('supports study-block create, edit, move, status and delete operations', () => {
    const local = memoryStorage(); const storage = planner(local)
    expect(storage.create('user-1', input).block.id).toBe('block-1')
    expect(storage.update('user-1', 'block-1', { title: 'Updated' }).block.title).toBe('Updated')
    expect(storage.move('user-1', 'block-1', { date: '2026-08-11', startMinutes: 600, endMinutes: 720 }).block).toMatchObject({ date: '2026-08-11', startMinutes: 600, endMinutes: 720 })
    expect(storage.setStatus('user-1', 'block-1', 'COMPLETED').block.status).toBe('COMPLETED')
    expect(storage.remove('user-1', 'block-1').deleted).toBe(true)
    expect(storage.load('user-1').blocks).toEqual([])
  })

  it('persists and reloads valid blocks', () => {
    const local = memoryStorage(); planner(local).create('user-1', input)
    expect(planner(local).load('user-1').blocks).toHaveLength(1)
  })

  it('recovers safely from malformed and unsupported storage payloads', () => {
    const local = memoryStorage(); const storage = planner(local); const key = storage.keyForUser('user-1')
    local.setItem(key, '{bad json'); expect(storage.load('user-1').blocks).toEqual([]); expect(local.getItem(key)).toBeNull()
    local.setItem(key, JSON.stringify({ version: 99, blocks: [{ id: 'old' }] })); expect(storage.load('user-1').blocks).toEqual([]); expect(local.getItem(key)).toBeNull()
  })

  it('rejects foreign-user records stored under another user key', () => {
    const local = memoryStorage(); const storage = planner(local)
    const foreign = storage.create('user-1', input).block
    local.setItem(storage.keyForUser('user-2'), JSON.stringify({ version: 1, blocks: [foreign] }))
    expect(storage.load('user-2').blocks).toEqual([])
  })
})
