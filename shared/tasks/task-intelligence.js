const dayKey = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
const active = task => !['COMPLETED', 'CANCELLED'].includes(task?.status)
export const isTaskOverdue = (task, now = new Date()) => Boolean(active(task) && task?.dueAt && new Date(task.dueAt) < now && dayKey(task.dueAt) !== dayKey(now))
export const isTaskDueToday = (task, now = new Date()) => Boolean(active(task) && task?.dueAt && dayKey(task.dueAt) === dayKey(now))
export const isTaskUpcoming = (task, days = 7, now = new Date()) => { if (!active(task) || !task?.dueAt) return false; const due = new Date(task.dueAt); return due >= now && due <= new Date(now.getTime() + days * 86_400_000) }
export function subtaskProgress(subtasks = []) { const completed = subtasks.filter(item => item.status === 'COMPLETED').length; return { completed, total: subtasks.length, percentage: subtasks.length ? Math.round(completed / subtasks.length * 100) : 0 } }
export function estimatedRemainingMinutes(task) { const own = task?.status === 'COMPLETED' ? 0 : Number(task?.estimatedMinutes || 0); return own + (task?.subtasks || []).reduce((sum, item) => sum + (item.status === 'COMPLETED' ? 0 : Number(item.estimatedMinutes || 0)), 0) }
const priority = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
export function compareTasks(left, right, now = new Date()) {
  const bucket = task => isTaskOverdue(task, now) ? 0 : isTaskDueToday(task, now) ? 1 : ['URGENT', 'HIGH'].includes(task.priority) ? 2 : 3
  const leftBucket = bucket(left); const rightBucket = bucket(right)
  const sourcePriority = leftBucket === 2 && rightBucket === 2 ? (priority[left.priority] ?? 9) - (priority[right.priority] ?? 9) : 0
  return leftBucket - rightBucket || sourcePriority || (left.dueAt ? new Date(left.dueAt).getTime() : Infinity) - (right.dueAt ? new Date(right.dueAt).getTime() : Infinity) || (left.assessment?.officialDeadline ? new Date(left.assessment.officialDeadline).getTime() : Infinity) - (right.assessment?.officialDeadline ? new Date(right.assessment.officialDeadline).getTime() : Infinity) || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || String(left.id).localeCompare(String(right.id))
}
export function filterTasks(tasks, { view = 'ALL', now = new Date(), upcomingDays = 7 } = {}) { return tasks.filter(task => view === 'ALL' || view === 'TODAY' && isTaskDueToday(task, now) || view === 'OVERDUE' && isTaskOverdue(task, now) || view === 'UPCOMING' && isTaskUpcoming(task, upcomingDays, now) || view === 'BACKLOG' && task.status === 'BACKLOG' || view === 'COMPLETED' && task.status === 'COMPLETED').toSorted((a, b) => compareTasks(a, b, now)) }
export const recordedFocusSecondsForTask = (sessions = [], taskId) => sessions.filter(item => item.taskId === taskId).reduce((sum, item) => sum + Number(item.actualFocusedSeconds || 0), 0)
