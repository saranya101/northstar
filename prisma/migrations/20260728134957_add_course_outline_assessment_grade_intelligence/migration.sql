-- CreateEnum
CREATE TYPE "CourseOutlineImportSource" AS ENUM ('PDF', 'IMAGE', 'TEXT', 'MANUAL');

-- CreateEnum
CREATE TYPE "CourseOutlineImportStatus" AS ENUM ('PROCESSING', 'REVIEW_REQUIRED', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseOutlineCandidateStatus" AS ENUM ('SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'MIDTERM', 'FINAL_EXAMINATION', 'INDIVIDUAL_ASSIGNMENT', 'GROUP_ASSIGNMENT', 'PRESENTATION', 'CLASS_PARTICIPATION', 'ATTENDANCE', 'REFLECTION', 'CASE_ANALYSIS', 'REPORT', 'PROJECT', 'PRACTICAL', 'LABORATORY', 'ORAL_EXAMINATION', 'PEER_ASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'PLANNING', 'IN_PROGRESS', 'WAITING_ON_TEAMMATE', 'READY_FOR_REVIEW', 'SUBMITTED', 'GRADED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentMilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "UserModuleEnrolment" ADD COLUMN     "targetLabel" TEXT,
ADD COLUMN     "targetPercentage" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "CourseOutlineImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userModuleEnrolmentId" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sourceType" "CourseOutlineImportSource" NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "rawExtractedText" TEXT NOT NULL,
    "status" "CourseOutlineImportStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "parserVersion" TEXT NOT NULL,
    "extractionConfidence" DECIMAL(3,2),
    "safeErrorMessage" TEXT,
    "academicYear" TEXT,
    "semesterLabel" TEXT,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "userConfirmedCurrent" BOOLEAN NOT NULL DEFAULT false,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOutlineImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutlineAssessmentCandidate" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sourceOrder" INTEGER NOT NULL,
    "status" "CourseOutlineCandidateStatus" NOT NULL DEFAULT 'SELECTED',
    "name" TEXT,
    "type" "AssessmentType",
    "weight" DECIMAL(5,2),
    "officialDeadline" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "submissionPlatform" TEXT,
    "submissionUrl" TEXT,
    "instructions" TEXT,
    "groupAssessment" BOOLEAN,
    "examFormat" TEXT,
    "durationMinutes" INTEGER,
    "openBook" BOOLEAN,
    "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rubricHeadings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOutlineAssessmentCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutlineCandidateProvenance" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "sectionHeading" TEXT,
    "sourceExcerpt" TEXT,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseOutlineCandidateProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutlineFact" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceOrder" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "pageNumber" INTEGER,
    "sectionHeading" TEXT,
    "sourceExcerpt" TEXT,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOutlineFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutlineWeek" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "weekNumber" INTEGER,
    "topic" TEXT,
    "reading" TEXT,
    "activity" TEXT,
    "importantDate" TEXT,
    "sourceOrder" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "pageNumber" INTEGER,
    "sourceExcerpt" TEXT,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOutlineWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userModuleEnrolmentId" TEXT NOT NULL,
    "sourceImportId" TEXT,
    "sourceCandidateId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "weight" DECIMAL(5,2),
    "officialDeadline" TIMESTAMP(3),
    "internalDeadline" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "submissionPlatform" TEXT,
    "submissionUrl" TEXT,
    "instructions" TEXT,
    "examFormat" TEXT,
    "estimatedEffortMinutes" INTEGER,
    "actualEffortMinutes" INTEGER,
    "groupAssessment" BOOLEAN,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "score" DECIMAL(10,2),
    "maximumScore" DECIMAL(10,2),
    "percentageScore" DECIMAL(7,4),
    "weightedScore" DECIMAL(7,4),
    "feedback" TEXT,
    "reflection" TEXT,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentProvenance" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sourceImportId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "sourceType" "CourseOutlineImportSource" NOT NULL,
    "pageNumber" INTEGER,
    "sectionHeading" TEXT,
    "sourceExcerpt" TEXT,
    "confidence" DECIMAL(3,2),
    "userConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentDeliverable" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentMilestone" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "AssessmentMilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "estimatedEffortMinutes" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseOutlineImport_userId_createdAt_idx" ON "CourseOutlineImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseOutlineImport_userModuleEnrolmentId_status_idx" ON "CourseOutlineImport"("userModuleEnrolmentId", "status");

-- CreateIndex
CREATE INDEX "CourseOutlineAssessmentCandidate_importId_sourceOrder_idx" ON "CourseOutlineAssessmentCandidate"("importId", "sourceOrder");

-- CreateIndex
CREATE INDEX "CourseOutlineCandidateProvenance_candidateId_idx" ON "CourseOutlineCandidateProvenance"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOutlineCandidateProvenance_candidateId_fieldName_key" ON "CourseOutlineCandidateProvenance"("candidateId", "fieldName");

-- CreateIndex
CREATE INDEX "CourseOutlineFact_importId_sourceOrder_idx" ON "CourseOutlineFact"("importId", "sourceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOutlineFact_importId_fieldName_key" ON "CourseOutlineFact"("importId", "fieldName");

-- CreateIndex
CREATE INDEX "CourseOutlineWeek_importId_sourceOrder_idx" ON "CourseOutlineWeek"("importId", "sourceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_sourceCandidateId_key" ON "Assessment"("sourceCandidateId");

-- CreateIndex
CREATE INDEX "Assessment_userId_userModuleEnrolmentId_idx" ON "Assessment"("userId", "userModuleEnrolmentId");

-- CreateIndex
CREATE INDEX "Assessment_userModuleEnrolmentId_officialDeadline_idx" ON "Assessment"("userModuleEnrolmentId", "officialDeadline");

-- CreateIndex
CREATE INDEX "Assessment_sourceImportId_idx" ON "Assessment"("sourceImportId");

-- CreateIndex
CREATE INDEX "AssessmentProvenance_sourceImportId_idx" ON "AssessmentProvenance"("sourceImportId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentProvenance_assessmentId_fieldName_key" ON "AssessmentProvenance"("assessmentId", "fieldName");

-- CreateIndex
CREATE INDEX "AssessmentDeliverable_assessmentId_sortOrder_idx" ON "AssessmentDeliverable"("assessmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentMilestone_assessmentId_sortOrder_idx" ON "AssessmentMilestone"("assessmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentMilestone_dueDate_idx" ON "AssessmentMilestone"("dueDate");

-- AddForeignKey
ALTER TABLE "CourseOutlineImport" ADD CONSTRAINT "CourseOutlineImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutlineImport" ADD CONSTRAINT "CourseOutlineImport_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutlineAssessmentCandidate" ADD CONSTRAINT "CourseOutlineAssessmentCandidate_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourseOutlineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutlineCandidateProvenance" ADD CONSTRAINT "CourseOutlineCandidateProvenance_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CourseOutlineAssessmentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutlineFact" ADD CONSTRAINT "CourseOutlineFact_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourseOutlineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutlineWeek" ADD CONSTRAINT "CourseOutlineWeek_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourseOutlineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "CourseOutlineImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentProvenance" ADD CONSTRAINT "AssessmentProvenance_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDeliverable" ADD CONSTRAINT "AssessmentDeliverable_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentMilestone" ADD CONSTRAINT "AssessmentMilestone_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
