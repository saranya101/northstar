import { describe, expect, it, vi } from 'vitest'
vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
import { createTask, deleteTask, getTask, listTasks, setTaskCompleted, updateTask } from '../server/services/tasks'
import { compareTasks, estimatedRemainingMinutes, filterTasks, isTaskDueToday, isTaskOverdue, isTaskUpcoming, recordedFocusSecondsForTask, subtaskProgress } from '../shared/tasks/task-intelligence'
import { focusRouteForTask, plannerRouteForTask } from '../shared/tasks/task-routes'
import { createTaskSchema, updateTaskSchema } from '../shared/schemas/tasks'
import { createStudySessionRecord, createTimerState, SESSION_COMPLETION_STATES } from '../shared/focus/timer'
import { createFocusStorage } from '../app/utils/focus-storage.client'

const now = new Date('2026-08-07T04:00:00.000Z')
const base = (overrides = {}) => ({ id: 't1', userId: 'u1', moduleEnrolmentId: null, assessmentId: null, recurringCourseworkId: null, recurringCourseworkOccurrenceId: null, assessmentMilestoneId: null, parentTaskId: null, title: 'Revise TVM', description: null, type: 'REVISION', status: 'BACKLOG', priority: 'MEDIUM', dueAt: null, timingNote: 'Before Week 8 quiz', estimatedMinutes: 60, actualMinutes: null, sortOrder: 0, startedAt: null, completedAt: null, createdAt: now, updatedAt: now, moduleEnrolment: null, assessment: null, recurringCoursework: null, recurringCourseworkOccurrence: null, assessmentMilestone: null, parentTask: null, subtasks: [], ...overrides })
const database = record => ({ task: { findFirst: vi.fn().mockResolvedValue(record), create: vi.fn(async ({ data }) => base(data)), update: vi.fn(async ({ data }) => base({ ...record, ...data })), deleteMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([record]) }, $transaction: vi.fn(callback => callback(database(record))) })

describe('task validation and persistence', () => {
  it('accepts general, module and numeric-string task creation without inventing dates', () => {
    const general = createTaskSchema.parse({ title: 'Admin', type: 'ADMIN', priority: 'LOW', estimatedMinutes: '15', timingNote: 'Before registration' })
    expect(general).toMatchObject({ estimatedMinutes: 15, status: 'BACKLOG' })
    expect(general.dueAt).toBeUndefined()
    expect(createTaskSchema.safeParse({ title: '', type: 'STUDY' }).success).toBe(false)
    expect(updateTaskSchema.parse({ dueAt: '', assessmentId: '' })).toEqual({ dueAt: null, assessmentId: null })
  })

  it('creates an owner-scoped general task transactionally', async () => {
    const db = database(null)
    const task = await createTask('u1', { title: 'General task', type: 'ADMIN', status: 'BACKLOG', priority: 'LOW' }, db)
    expect(task.title).toBe('General task')
    expect(db.$transaction).toHaveBeenCalled()
  })

  it('validates module, assessment and occurrence ownership and matching modules', async () => {
    const tx = database(null)
    tx.userModuleEnrolment = { findFirst: vi.fn().mockResolvedValue({ id: 'e1' }) }
    tx.assessment = { findFirst: vi.fn().mockResolvedValue({ id: 'a1', userModuleEnrolmentId: 'e1' }), update: vi.fn() }
    tx.recurringCoursework = { findFirst: vi.fn() }
    tx.recurringCourseworkOccurrence = { findFirst: vi.fn().mockResolvedValue({ id: 'o1', recurringCourseworkId: 'r1', recurringCoursework: { userModuleEnrolmentId: 'e1' } }) }
    const db = { $transaction: callback => callback(tx) }
    await createTask('u1', { title: 'LAMS Week 1', type: 'PRACTICE', status: 'BACKLOG', priority: 'HIGH', moduleEnrolmentId: 'e1', assessmentId: 'a1', recurringCourseworkOccurrenceId: 'o1' }, db)
    expect(tx.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }))
    expect(tx.assessment.update).not.toHaveBeenCalled()
    tx.userModuleEnrolment.findFirst.mockResolvedValue(null)
    await expect(createTask('u2', { title: 'Foreign', moduleEnrolmentId: 'e1', type: 'STUDY', status: 'BACKLOG', priority: 'LOW' }, db)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('maps the occurrence unique constraint to duplicate prevention', async () => {
    const db = { $transaction: vi.fn().mockRejectedValue({ code: 'P2002' }) }
    await expect(createTask('u1', { title: 'Duplicate', type: 'STUDY', status: 'BACKLOG', priority: 'LOW' }, db)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('owner-isolates reads, updates and deletes', async () => {
    await expect(getTask('u2', 't1', { task: { findFirst: vi.fn().mockResolvedValue(null) } })).rejects.toMatchObject({ statusCode: 404 })
    await expect(updateTask('u2', 't1', { title: 'Nope' }, { $transaction: callback => callback({ task: { findFirst: vi.fn().mockResolvedValue(null) } }) })).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteTask('u2', 't1', { task: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('stores completion timestamps and clears them on reopen without touching sources', async () => {
    const current = base()
    const db = database(current)
    const completed = await setTaskCompleted('u1', 't1', true, db)
    expect(completed.status).toBe('COMPLETED')
    expect(completed.completedAt).not.toBeNull()
    db.task.findFirst.mockResolvedValue(base({ status: 'COMPLETED', completedAt: now }))
    const reopened = await setTaskCompleted('u1', 't1', false, db)
    expect(reopened).toMatchObject({ status: 'PLANNED', completedAt: null })
    expect(db.recurringCourseworkOccurrence).toBeUndefined()
    expect(db.assessment).toBeUndefined()
  })

  it('supports rescheduling and deletion', async () => {
    const db = database(base())
    const dueAt = new Date('2026-08-09T02:00:00.000Z')
    expect(await updateTask('u1', 't1', { dueAt }, db)).toMatchObject({ dueAt: dueAt.toISOString() })
    await expect(deleteTask('u1', 't1', db)).resolves.toEqual({ deleted: true })
  })
})

describe('deterministic task intelligence', () => {
  const overdue = base({ id: 'overdue', dueAt: '2026-08-06T02:00:00.000Z', priority: 'LOW' })
  const today = base({ id: 'today', dueAt: '2026-08-07T10:00:00.000Z' })
  const upcoming = base({ id: 'upcoming', dueAt: '2026-08-10T02:00:00.000Z', priority: 'URGENT' })
  it('calculates overdue, today and upcoming views', () => { expect(isTaskOverdue(overdue, now)).toBe(true); expect(isTaskDueToday(today, now)).toBe(true); expect(isTaskUpcoming(upcoming, 7, now)).toBe(true); expect(filterTasks([upcoming, today, overdue], { view: 'OVERDUE', now })).toEqual([overdue]) })
  it('orders overdue before today before high priority with stable created/id ties', () => { expect([upcoming, today, overdue].toSorted((a,b) => compareTasks(a,b,now)).map(item => item.id)).toEqual(['overdue','today','upcoming']); expect(compareTasks(base({ id: 'a' }), base({ id: 'b' }), now)).toBeLessThan(0) })
  it('orders ordinary priorities by due date after urgent/high tasks', () => { const lowSoon = base({ id: 'low', priority: 'LOW', dueAt: '2026-08-10T00:00:00.000Z' }); const mediumLater = base({ id: 'medium', priority: 'MEDIUM', dueAt: '2026-08-11T00:00:00.000Z' }); expect(compareTasks(lowSoon, mediumLater, now)).toBeLessThan(0) })
  it('calculates subtask progress and remaining estimates without auto-completing parents', () => { const subtasks = [base({ status: 'COMPLETED', estimatedMinutes: 10 }), base({ id: 's2', estimatedMinutes: 20 })]; expect(subtaskProgress(subtasks)).toEqual({ completed: 1, total: 2, percentage: 50 }); expect(estimatedRemainingMinutes(base({ estimatedMinutes: 30, subtasks }))).toBe(50) })
  it('applies server-side source filters', async () => { const db = database(base()); await listTasks('u1', { assessmentId: 'a1', view: 'ALL' }, db, now); expect(db.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', assessmentId: 'a1' }) })) })
})

describe('Planner and Focus task integration', () => {
  const linked = base({ id: 'task & 1', moduleEnrolmentId: 'e1', moduleCode: 'AB1201', title: 'Finish Q1 & Q2', estimatedMinutes: 45 })
  it('builds safe Planner and Focus URLs', () => { expect(plannerRouteForTask(linked)).toEqual({ path: '/app/planner', query: { taskId: 'task & 1', moduleEnrolmentId: 'e1', moduleCode: 'AB1201', title: 'Finish Q1 & Q2', estimatedMinutes: '45' } }); expect(focusRouteForTask(linked)).toEqual({ path: '/app/focus', query: { taskId: 'task & 1', module: 'e1', moduleCode: 'AB1201', goal: 'Finish Q1 & Q2' } }) })
  it('retains optional task IDs in local Focus history while general sessions still work', () => { const timer = createTimerState({ sessionId: 's1', userId: 'u1', now, plannedDurationSeconds: 60, focusDurationSeconds: 60, breakDurationSeconds: 0, taskId: 't1' }); const record = createStudySessionRecord(timer, now.getTime() + 60_000, SESSION_COMPLETION_STATES.COMPLETED); expect(record.taskId).toBe('t1'); const general = createTimerState({ sessionId: 's2', userId: 'u1', now, plannedDurationSeconds: 60, focusDurationSeconds: 60, breakDurationSeconds: 0 }); expect(createStudySessionRecord(general, now.getTime() + 60_000).taskId).toBeNull() })
  it('sums only local sessions linked to a task', () => { expect(recordedFocusSecondsForTask([{ taskId: 't1', actualFocusedSeconds: 120 }, { taskId: null, actualFocusedSeconds: 60 }], 't1')).toBe(120) })
  it('round-trips task metadata through owner-scoped Focus storage', () => { const values = new Map(); const storage = createFocusStorage({ getItem: key => values.get(key) || null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) }); const timer = createTimerState({ sessionId: 's1', userId: 'u1', now, plannedDurationSeconds: 60, focusDurationSeconds: 60, breakDurationSeconds: 0, taskId: 't1' }); storage.saveActiveTimer('u1', timer); expect(storage.load('u1').activeTimer.taskId).toBe('t1') })
})
