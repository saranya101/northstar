CREATE TYPE "TaskType" AS ENUM ('STUDY', 'REVISION', 'ASSIGNMENT', 'READING', 'PRACTICE', 'ADMIN', 'GROUP_WORK', 'OTHER');
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleEnrolmentId" TEXT,
  "assessmentId" TEXT,
  "recurringCourseworkId" TEXT,
  "recurringCourseworkOccurrenceId" TEXT,
  "assessmentMilestoneId" TEXT,
  "parentTaskId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "TaskType" NOT NULL DEFAULT 'STUDY',
  "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3),
  "timingNote" TEXT,
  "estimatedMinutes" INTEGER,
  "actualMinutes" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Task_userId_recurringCourseworkOccurrenceId_key" ON "Task"("userId", "recurringCourseworkOccurrenceId");
CREATE UNIQUE INDEX "Task_userId_assessmentMilestoneId_key" ON "Task"("userId", "assessmentMilestoneId");
CREATE INDEX "Task_userId_status_dueAt_idx" ON "Task"("userId", "status", "dueAt");
CREATE INDEX "Task_moduleEnrolmentId_idx" ON "Task"("moduleEnrolmentId");
CREATE INDEX "Task_assessmentId_idx" ON "Task"("assessmentId");
CREATE INDEX "Task_recurringCourseworkId_idx" ON "Task"("recurringCourseworkId");
CREATE INDEX "Task_parentTaskId_sortOrder_idx" ON "Task"("parentTaskId", "sortOrder");

ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_moduleEnrolmentId_fkey" FOREIGN KEY ("moduleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurringCourseworkId_fkey" FOREIGN KEY ("recurringCourseworkId") REFERENCES "RecurringCoursework"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurringCourseworkOccurrenceId_fkey" FOREIGN KEY ("recurringCourseworkOccurrenceId") REFERENCES "RecurringCourseworkOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assessmentMilestoneId_fkey" FOREIGN KEY ("assessmentMilestoneId") REFERENCES "AssessmentMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
