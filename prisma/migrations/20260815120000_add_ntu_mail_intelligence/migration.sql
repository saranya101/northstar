CREATE TYPE "MailClassification" AS ENUM ('ACTION_REQUIRED', 'ACADEMIC_ADMIN', 'OPPORTUNITY', 'EVENT', 'NOISE', 'UNCERTAIN');
CREATE TYPE "MailConfidenceBand" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "MailIntakeStatus" AS ENUM ('NEW', 'REVIEWED', 'CONVERTED', 'DISMISSED');

CREATE TABLE "MailIntake" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subject" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "receivedAt" TIMESTAMP(3),
  "rawText" TEXT NOT NULL,
  "contentFingerprint" TEXT NOT NULL,
  "classification" "MailClassification" NOT NULL,
  "confidenceBand" "MailConfidenceBand" NOT NULL,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "extractedPayload" JSONB,
  "status" "MailIntakeStatus" NOT NULL DEFAULT 'NEW',
  "interpreterKey" TEXT NOT NULL DEFAULT 'ntu-mail-deterministic-v1',
  "convertedOpportunityId" TEXT,
  "convertedTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MailIntake_userId_contentFingerprint_key" ON "MailIntake"("userId", "contentFingerprint");
CREATE INDEX "MailIntake_userId_status_createdAt_idx" ON "MailIntake"("userId", "status", "createdAt");
CREATE INDEX "MailIntake_convertedOpportunityId_idx" ON "MailIntake"("convertedOpportunityId");
CREATE INDEX "MailIntake_convertedTaskId_idx" ON "MailIntake"("convertedTaskId");

ALTER TABLE "MailIntake" ADD CONSTRAINT "MailIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailIntake" ADD CONSTRAINT "MailIntake_convertedOpportunityId_fkey" FOREIGN KEY ("convertedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailIntake" ADD CONSTRAINT "MailIntake_convertedTaskId_fkey" FOREIGN KEY ("convertedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
