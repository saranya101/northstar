-- CreateEnum
CREATE TYPE "TimetableImportStatus" AS ENUM ('PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimetableImportSource" AS ENUM ('NTU_REGISTERED_COURSES_PDF', 'NTU_REGISTERED_COURSES_IMAGE', 'NTU_TIMETABLE_IMAGE', 'PASTED_TEXT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ClassSessionType" AS ENUM ('LECTURE', 'TUTORIAL', 'SEMINAR', 'LABORATORY', 'WORKSHOP', 'PROJECT', 'FIELDWORK', 'OTHER');

-- CreateEnum
CREATE TYPE "ClassSessionSource" AS ENUM ('IMPORTED', 'MANUAL', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "SessionRecurrence" AS ENUM ('WEEKLY', 'ODD_WEEKS', 'EVEN_WEEKS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CourseRegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'EXEMPTED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "UserModuleEnrolment" ADD COLUMN     "courseType" TEXT,
ADD COLUMN     "indexNumber" TEXT,
ADD COLUMN     "registrationStatus" "CourseRegistrationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "TimetableImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userSemesterId" TEXT NOT NULL,
    "source" "TimetableImportSource" NOT NULL,
    "status" "TimetableImportStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "parserVersion" TEXT NOT NULL,
    "candidatePayload" JSONB NOT NULL,
    "warnings" JSONB,
    "detectedModuleCount" INTEGER NOT NULL DEFAULT 0,
    "detectedSessionCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "userModuleEnrolmentId" TEXT NOT NULL,
    "classType" "ClassSessionType" NOT NULL,
    "groupLabel" TEXT NOT NULL DEFAULT 'DEFAULT',
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "venue" TEXT,
    "recurrence" "SessionRecurrence" NOT NULL DEFAULT 'WEEKLY',
    "weekNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "source" "ClassSessionSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableImport_userId_idx" ON "TimetableImport"("userId");

-- CreateIndex
CREATE INDEX "TimetableImport_userSemesterId_idx" ON "TimetableImport"("userSemesterId");

-- CreateIndex
CREATE INDEX "TimetableImport_status_idx" ON "TimetableImport"("status");

-- CreateIndex
CREATE INDEX "TimetableImport_createdAt_idx" ON "TimetableImport"("createdAt");

-- CreateIndex
CREATE INDEX "ClassSession_userModuleEnrolmentId_idx" ON "ClassSession"("userModuleEnrolmentId");

-- CreateIndex
CREATE INDEX "ClassSession_dayOfWeek_idx" ON "ClassSession"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ClassSession_startMinutes_idx" ON "ClassSession"("startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_userModuleEnrolmentId_classType_groupLabel_day_key" ON "ClassSession"("userModuleEnrolmentId", "classType", "groupLabel", "dayOfWeek", "startMinutes", "endMinutes");

-- AddForeignKey
ALTER TABLE "TimetableImport" ADD CONSTRAINT "TimetableImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableImport" ADD CONSTRAINT "TimetableImport_userSemesterId_fkey" FOREIGN KEY ("userSemesterId") REFERENCES "UserSemester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
