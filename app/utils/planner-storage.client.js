import { PLANNER_STORAGE_VERSION, STUDY_BLOCK_STATUSES, createStudyBlock, sanitizeStudyBlock, validateStudyBlockInput } from '~~/shared/planner/weekly-planner'

const PREFIX = 'northstar:weekly-planner:user:'
const MAX_BLOCKS = 1000

function keyForUser(userId) {
  return `${PREFIX}${encodeURIComponent(String(userId || ''))}`
}

function emptyState() {
  return { version: PLANNER_STORAGE_VERSION, blocks: [] }
}

function sanitizeState(value, userId) {
  if (!value || typeof value !== 'object' || value.version !== PLANNER_STORAGE_VERSION) return emptyState()
  const seen = new Set()
  const blocks = []
  for (const candidate of Array.isArray(value.blocks) ? value.blocks : []) {
    const block = sanitizeStudyBlock(candidate, userId)
    if (!block || seen.has(block.id)) continue
    seen.add(block.id)
    blocks.push(block)
    if (blocks.length >= MAX_BLOCKS) break
  }
  blocks.sort((left, right) => left.date.localeCompare(right.date) || left.startMinutes - right.startMinutes || left.createdAt.localeCompare(right.createdAt))
  return { version: PLANNER_STORAGE_VERSION, blocks }
}

export function createPlannerStorage(storage = globalThis.localStorage, options = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new TypeError('A local-storage-compatible object is required.')
  const now = options.now || (() => new Date())
  const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID?.() || `study-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  function read(userId) {
    const key = keyForUser(userId)
    const raw = storage.getItem(key)
    if (!raw) return emptyState()
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.version !== PLANNER_STORAGE_VERSION) {
        storage.removeItem?.(key)
        return emptyState()
      }
      return sanitizeState(parsed, userId)
    } catch {
      storage.removeItem?.(key)
      return emptyState()
    }
  }

  function write(userId, state) {
    const clean = sanitizeState({ ...state, version: PLANNER_STORAGE_VERSION }, userId)
    storage.setItem(keyForUser(userId), JSON.stringify(clean))
    return clean
  }

  return {
    keyForUser,
    load: read,
    replace(userId, blocks) {
      return write(userId, { blocks })
    },
    create(userId, input) {
      const current = read(userId)
      const created = createStudyBlock(input, { userId, id: idFactory(), now: now() })
      if (!created.block) return { state: current, block: null, errors: created.errors }
      const state = write(userId, { blocks: [...current.blocks, created.block] })
      return { state, block: created.block, errors: {} }
    },
    update(userId, id, patch) {
      const current = read(userId)
      const existing = current.blocks.find(block => block.id === id)
      if (!existing) return { state: current, block: null, errors: { id: 'Study block not found.' } }
      const validation = validateStudyBlockInput({ ...existing, ...patch })
      if (!validation.valid) return { state: current, block: null, errors: validation.errors }
      const updated = { ...existing, ...validation.value, updatedAt: now().toISOString() }
      const state = write(userId, { blocks: current.blocks.map(block => block.id === id ? updated : block) })
      return { state, block: updated, errors: {} }
    },
    move(userId, id, { date, startMinutes, endMinutes }) {
      return this.update(userId, id, { date, startMinutes, endMinutes })
    },
    remove(userId, id) {
      const current = read(userId)
      const state = write(userId, { blocks: current.blocks.filter(block => block.id !== id) })
      return { state, deleted: state.blocks.length !== current.blocks.length }
    },
    setStatus(userId, id, status) {
      if (!STUDY_BLOCK_STATUSES.includes(status)) return { state: read(userId), block: null, errors: { status: 'Invalid study-block status.' } }
      return this.update(userId, id, { status })
    },
    removeUserData(userId) {
      storage.removeItem?.(keyForUser(userId))
    },
  }
}
