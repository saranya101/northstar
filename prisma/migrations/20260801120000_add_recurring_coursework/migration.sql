CREATE TYPE "RecurringCourseworkType" AS ENUM ('LAMS', 'ONLINE_ASSIGNMENT', 'QUIZ', 'READING', 'TUTORIAL_PREPARATION', 'SEMINAR_PREPARATION', 'PARTICIPATION', 'OTHER');
CREATE TYPE "RecurringCourseworkFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'CUSTOM');
CREATE TYPE "RecurringCourseworkStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "RecurringCourseworkOccurrenceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'MISSED', 'EXCUSED');

CREATE TABLE "RecurringCoursework" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userModuleEnrolmentId" TEXT NOT NULL,
  "assessmentId" TEXT,
  "title" TEXT NOT NULL,
  "type" "RecurringCourseworkType" NOT NULL,
  "description" TEXT,
  "frequency" "RecurringCourseworkFrequency" NOT NULL,
  "totalExpected" INTEGER NOT NULL,
  "firstTeachingWeek" INTEGER,
  "lastTeachingWeek" INTEGER,
  "recessWeeks" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "includeRecessWeeks" BOOLEAN NOT NULL DEFAULT false,
  "graded" BOOLEAN NOT NULL DEFAULT false,
  "totalAssessmentWeight" DECIMAL(5,2),
  "completeBeforeClass" BOOLEAN NOT NULL DEFAULT false,
  "timingNote" TEXT,
  "status" "RecurringCourseworkStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringCoursework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringCourseworkOccurrence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recurringCourseworkId" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "teachingWeek" INTEGER,
  "officialDueAt" TIMESTAMP(3),
  "timingNote" TEXT,
  "status" "RecurringCourseworkOccurrenceStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "workCompleted" BOOLEAN NOT NULL DEFAULT false,
  "finalConfirmationClicked" BOOLEAN NOT NULL DEFAULT false,
  "gradeCentreChecked" BOOLEAN NOT NULL DEFAULT false,
  "markCaptured" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "score" DECIMAL(10,2),
  "maximumScore" DECIMAL(10,2),
  "submissionReference" TEXT,
  "privateNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringCourseworkOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringCoursework_userId_userModuleEnrolmentId_status_idx" ON "RecurringCoursework"("userId", "userModuleEnrolmentId", "status");
CREATE INDEX "RecurringCoursework_assessmentId_idx" ON "RecurringCoursework"("assessmentId");
CREATE UNIQUE INDEX "RecurringCourseworkOccurrence_recurringCourseworkId_sequenceNumber_key" ON "RecurringCourseworkOccurrence"("recurringCourseworkId", "sequenceNumber");
CREATE INDEX "RecurringCourseworkOccurrence_userId_status_idx" ON "RecurringCourseworkOccurrence"("userId", "status");
CREATE INDEX "RecurringCourseworkOccurrence_officialDueAt_idx" ON "RecurringCourseworkOccurrence"("officialDueAt");

ALTER TABLE "RecurringCoursework" ADD CONSTRAINT "RecurringCoursework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringCoursework" ADD CONSTRAINT "RecurringCoursework_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringCoursework" ADD CONSTRAINT "RecurringCoursework_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringCourseworkOccurrence" ADD CONSTRAINT "RecurringCourseworkOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringCourseworkOccurrence" ADD CONSTRAINT "RecurringCourseworkOccurrence_recurringCourseworkId_fkey" FOREIGN KEY ("recurringCourseworkId") REFERENCES "RecurringCoursework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
