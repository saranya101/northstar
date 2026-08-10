ALTER TABLE "Assessment" DROP CONSTRAINT IF EXISTS "Assessment_sourceImportId_fkey";
ALTER TABLE "Assessment" DROP COLUMN IF EXISTS "sourceImportId", DROP COLUMN IF EXISTS "sourceCandidateId";
ALTER TABLE "ModuleOffering" DROP COLUMN IF EXISTS "courseOutlineFileUrl";

DROP TABLE IF EXISTS "AssessmentProvenance";
DROP TABLE IF EXISTS "CourseDocumentEvidence";
DROP TABLE IF EXISTS "CourseDocumentProposal";
DROP TABLE IF EXISTS "CourseOutlineCandidateProvenance";
DROP TABLE IF EXISTS "CourseOutlineAssessmentCandidate";
DROP TABLE IF EXISTS "CourseOutlineFact";
DROP TABLE IF EXISTS "CourseOutlineWeek";
DROP TABLE IF EXISTS "CourseOutlineImport";

DROP TYPE IF EXISTS "CourseOutlineCandidateStatus";
DROP TYPE IF EXISTS "CourseDocumentTargetType";
DROP TYPE IF EXISTS "CourseDocumentProposalStatus";
DROP TYPE IF EXISTS "CourseDocumentChangeType";
DROP TYPE IF EXISTS "CourseDocumentType";
DROP TYPE IF EXISTS "CourseOutlineImportStatus";
DROP TYPE IF EXISTS "CourseOutlineImportSource";

CREATE TYPE "AcademicIntakeCategory" AS ENUM ('ASSESSMENT_UPDATE', 'NEW_ASSESSMENT', 'COURSEWORK', 'DEADLINE', 'CLASS_UPDATE', 'TASK', 'STUDY_PLAN', 'GRADE_RESULT', 'LECTURER_INSTRUCTION', 'EXAM_INFORMATION', 'ANNOUNCEMENT', 'GENERAL_NOTE');
CREATE TYPE "AcademicIntakeStatus" AS ENUM ('PENDING_REVIEW', 'APPLIED', 'DISMISSED', 'NEEDS_CLARIFICATION', 'FAILED');
CREATE TYPE "AcademicProposalAction" AS ENUM ('CREATE_TASK', 'UPDATE_TASK', 'CREATE_ASSESSMENT', 'UPDATE_ASSESSMENT', 'CREATE_COURSEWORK', 'UPDATE_COURSEWORK', 'RECORD_GRADE', 'CREATE_STUDY_PLAN', 'ADD_NOTE');
CREATE TYPE "AcademicProposalTarget" AS ENUM ('TASK', 'ASSESSMENT', 'RECURRING_COURSEWORK', 'STUDY_PLAN', 'MODULE_NOTE');
CREATE TYPE "AcademicProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'CONFLICT');

CREATE TABLE "AcademicIntake" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleEnrolmentId" TEXT,
  "rawText" TEXT NOT NULL,
  "detectedCategory" "AcademicIntakeCategory" NOT NULL,
  "status" "AcademicIntakeStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "clarificationReason" TEXT,
  "interpreterKey" TEXT NOT NULL DEFAULT 'deterministic-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicIntake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicProposal" (
  "id" TEXT NOT NULL,
  "intakeId" TEXT NOT NULL,
  "actionType" "AcademicProposalAction" NOT NULL,
  "targetType" "AcademicProposalTarget" NOT NULL,
  "targetId" TEXT,
  "payload" JSONB NOT NULL,
  "status" "AcademicProposalStatus" NOT NULL DEFAULT 'PENDING',
  "conflictReason" TEXT,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcademicIntake_userId_status_createdAt_idx" ON "AcademicIntake"("userId", "status", "createdAt");
CREATE INDEX "AcademicIntake_moduleEnrolmentId_createdAt_idx" ON "AcademicIntake"("moduleEnrolmentId", "createdAt");
CREATE INDEX "AcademicProposal_intakeId_status_idx" ON "AcademicProposal"("intakeId", "status");
CREATE INDEX "AcademicProposal_targetType_targetId_idx" ON "AcademicProposal"("targetType", "targetId");

ALTER TABLE "AcademicIntake" ADD CONSTRAINT "AcademicIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicIntake" ADD CONSTRAINT "AcademicIntake_moduleEnrolmentId_fkey" FOREIGN KEY ("moduleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicProposal" ADD CONSTRAINT "AcademicProposal_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "AcademicIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
