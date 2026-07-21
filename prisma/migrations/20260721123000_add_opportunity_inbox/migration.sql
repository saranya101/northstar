-- CreateEnum
CREATE TYPE "OpportunityCategory" AS ENUM ('INTERNSHIP', 'PART_TIME_JOB', 'GRADUATE_PROGRAMME', 'HACKATHON', 'COMPETITION', 'VOLUNTEERING', 'CLUB', 'LEADERSHIP', 'SCHOLARSHIP', 'GRANT', 'RESEARCH', 'EXCHANGE', 'SUMMER_PROGRAMME', 'MENTORSHIP', 'ENTREPRENEURSHIP', 'WORKSHOP', 'TALK', 'NETWORKING', 'CERTIFICATION', 'AMBASSADOR', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunitySourceType" AS ENUM ('MANUAL', 'PASTED_TEXT', 'PASTED_LINK', 'PUBLIC_SOURCE', 'EMAIL', 'SCREENSHOT', 'PDF');

-- CreateEnum
CREATE TYPE "OpportunityMode" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "UserOpportunityStatus" AS ENUM ('SAVED', 'INTERESTED', 'APPLYING', 'APPLIED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'IGNORED');

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "category" "OpportunityCategory" NOT NULL,
    "description" TEXT,
    "sourceType" "OpportunitySourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "applicationUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "mode" "OpportunityMode" NOT NULL DEFAULT 'UNKNOWN',
    "commitment" TEXT,
    "eligibilityText" TEXT,
    "requirements" TEXT,
    "benefits" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "status" "UserOpportunityStatus" NOT NULL DEFAULT 'SAVED',
    "personalDeadline" TIMESTAMP(3),
    "notes" TEXT,
    "savedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opportunity_createdByUserId_idx" ON "Opportunity"("createdByUserId");
CREATE INDEX "Opportunity_deadline_idx" ON "Opportunity"("deadline");
CREATE INDEX "Opportunity_category_idx" ON "Opportunity"("category");
CREATE INDEX "Opportunity_category_deadline_idx" ON "Opportunity"("category", "deadline");
CREATE UNIQUE INDEX "UserOpportunity_userId_opportunityId_key" ON "UserOpportunity"("userId", "opportunityId");
CREATE INDEX "UserOpportunity_userId_idx" ON "UserOpportunity"("userId");
CREATE INDEX "UserOpportunity_userId_status_idx" ON "UserOpportunity"("userId", "status");
CREATE INDEX "UserOpportunity_opportunityId_idx" ON "UserOpportunity"("opportunityId");
CREATE INDEX "UserOpportunity_personalDeadline_idx" ON "UserOpportunity"("personalDeadline");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserOpportunity" ADD CONSTRAINT "UserOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserOpportunity" ADD CONSTRAINT "UserOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
