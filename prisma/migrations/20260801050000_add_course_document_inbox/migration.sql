CREATE TYPE "CourseDocumentType" AS ENUM ('COURSE_OUTLINE', 'ASSESSMENT_BRIEF', 'PRE_CLASS_BRIEFING', 'WEEKLY_SCHEDULE', 'RUBRIC', 'ANNOUNCEMENT', 'SEMINAR_MATERIAL', 'OTHER');
CREATE TYPE "CourseDocumentChangeType" AS ENUM ('ADD', 'FILL_MISSING', 'UPDATE', 'CONFLICT', 'DUPLICATE', 'NO_CHANGE');
CREATE TYPE "CourseDocumentProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CourseDocumentTargetType" AS ENUM ('MODULE_FACT', 'ASSESSMENT', 'WEEKLY_TOPIC');
ALTER TYPE "CourseOutlineImportStatus" ADD VALUE 'ARCHIVED';

ALTER TABLE "CourseOutlineImport"
  ADD COLUMN "documentType" "CourseDocumentType" NOT NULL DEFAULT 'COURSE_OUTLINE',
  ADD COLUMN "displayTitle" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "sha256Hash" TEXT,
  ADD COLUMN "sourceDate" TIMESTAMP(3),
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "duplicateLastSeenAt" TIMESTAMP(3);

CREATE TABLE "CourseDocumentProposal" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "targetType" "CourseDocumentTargetType" NOT NULL,
  "targetId" TEXT,
  "fieldName" TEXT NOT NULL,
  "currentValue" JSONB,
  "proposedValue" JSONB,
  "classification" "CourseDocumentChangeType" NOT NULL,
  "status" "CourseDocumentProposalStatus" NOT NULL DEFAULT 'PENDING',
  "confidence" DECIMAL(3,2),
  "pageNumber" INTEGER,
  "sourceExcerpt" TEXT,
  "sourceOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseDocumentProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseDocumentEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "targetType" "CourseDocumentTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "pageNumber" INTEGER,
  "sourceExcerpt" TEXT,
  "confidence" DECIMAL(3,2),
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseDocumentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleWeeklyTopic" (
  "id" TEXT NOT NULL,
  "userModuleEnrolmentId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "topic" TEXT,
  "reading" TEXT,
  "activity" TEXT,
  "importantDate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleWeeklyTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserModuleFact" (
  "id" TEXT NOT NULL,
  "userModuleEnrolmentId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserModuleFact_pkey" PRIMARY KEY ("id")
);

DROP INDEX "AssessmentProvenance_assessmentId_fieldName_key";
CREATE UNIQUE INDEX "AssessmentProvenance_assessmentId_sourceImportId_fieldName_key" ON "AssessmentProvenance"("assessmentId", "sourceImportId", "fieldName");
CREATE UNIQUE INDEX "CourseOutlineImport_userId_userModuleEnrolmentId_sha256Hash_key" ON "CourseOutlineImport"("userId", "userModuleEnrolmentId", "sha256Hash");
CREATE INDEX "CourseDocumentProposal_importId_sourceOrder_idx" ON "CourseDocumentProposal"("importId", "sourceOrder");
CREATE INDEX "CourseDocumentProposal_targetType_targetId_idx" ON "CourseDocumentProposal"("targetType", "targetId");
CREATE UNIQUE INDEX "CourseDocumentEvidence_importId_targetType_targetId_fieldName_key" ON "CourseDocumentEvidence"("importId", "targetType", "targetId", "fieldName");
CREATE INDEX "CourseDocumentEvidence_userId_targetType_targetId_idx" ON "CourseDocumentEvidence"("userId", "targetType", "targetId");
CREATE UNIQUE INDEX "ModuleWeeklyTopic_userModuleEnrolmentId_weekNumber_key" ON "ModuleWeeklyTopic"("userModuleEnrolmentId", "weekNumber");
CREATE INDEX "ModuleWeeklyTopic_userModuleEnrolmentId_idx" ON "ModuleWeeklyTopic"("userModuleEnrolmentId");
CREATE UNIQUE INDEX "UserModuleFact_userModuleEnrolmentId_fieldName_key" ON "UserModuleFact"("userModuleEnrolmentId", "fieldName");
CREATE INDEX "UserModuleFact_userModuleEnrolmentId_idx" ON "UserModuleFact"("userModuleEnrolmentId");

ALTER TABLE "CourseDocumentProposal" ADD CONSTRAINT "CourseDocumentProposal_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourseOutlineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseDocumentEvidence" ADD CONSTRAINT "CourseDocumentEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseDocumentEvidence" ADD CONSTRAINT "CourseDocumentEvidence_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourseOutlineImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModuleWeeklyTopic" ADD CONSTRAINT "ModuleWeeklyTopic_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModuleFact" ADD CONSTRAINT "UserModuleFact_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentProvenance" ADD CONSTRAINT "AssessmentProvenance_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "CourseOutlineImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
