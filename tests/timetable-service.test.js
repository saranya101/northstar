import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { confirmTimetableImport, deleteClassSession, getTimetableImport, updateClassSession } from '../server/services/timetable'

describe('timetable ownership', () => {
  it('returns 404 when another user reads an import', async () => {
    const database = { timetableImport: { findFirst: vi.fn().mockResolvedValue(null) } }
    await expect(getTimetableImport('other-user', 'import-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.timetableImport.findFirst).toHaveBeenCalledWith({ where: { id: 'import-1', userId: 'other-user' } })
  })
  it('does not edit or delete another user session', async () => {
    const database = { classSession: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), delete: vi.fn() } }
    await expect(updateClassSession('other-user', 'session-1', { venue: 'TR+1' }, database)).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteClassSession('other-user', 'session-1', database)).rejects.toMatchObject({ statusCode: 404 })
    expect(database.classSession.update).not.toHaveBeenCalled()
    expect(database.classSession.delete).not.toHaveBeenCalled()
  })
})

describe('import confirmation concurrency', () => {
  it('rejects stale confirmation before any academic writes', async () => {
    const transaction = {
      timetableImport: { findFirst: vi.fn().mockResolvedValue({ id: 'import-1', userId: 'user-1', status: 'NEEDS_REVIEW', updatedAt: new Date('2026-07-21T00:00:00.000Z') }) },
      module: { create: vi.fn() }
    }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: '2026-07-21T00:00:01.000Z', modules: [] }, database)).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.module.create).not.toHaveBeenCalled()
  })
  it('rejects an already confirmed import', async () => {
    const transaction = { timetableImport: { findFirst: vi.fn().mockResolvedValue({ id: 'import-1', status: 'CONFIRMED', updatedAt: new Date() }) } }
    const database = { $transaction: callback => callback(transaction) }
    await expect(confirmTimetableImport('user-1', 'import-1', { expectedUpdatedAt: new Date().toISOString(), modules: [] }, database)).rejects.toMatchObject({ statusCode: 409 })
  })
})
