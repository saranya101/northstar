-- CreateEnum
CREATE TYPE "OpportunitySyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "OpportunitySource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAttemptedAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySourceListing" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "externalId" TEXT,
    "normalizedSourceUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySourceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "OpportunitySyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "closedCount" INTEGER NOT NULL DEFAULT 0,
    "safeErrorMessage" TEXT,

    CONSTRAINT "OpportunitySyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityDuplicateReview" (
    "id" TEXT NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "candidateOpportunityId" TEXT NOT NULL,
    "probableMatchOpportunityId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityDuplicateReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySource_slug_key" ON "OpportunitySource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySource_adapterKey_key" ON "OpportunitySource"("adapterKey");

-- CreateIndex
-- CreateIndex
CREATE INDEX "OpportunitySourceListing_sourceId_active_idx" ON "OpportunitySourceListing"("sourceId", "active");

-- CreateIndex
CREATE INDEX "OpportunitySourceListing_opportunityId_idx" ON "OpportunitySourceListing"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunitySourceListing_lastSeenAt_idx" ON "OpportunitySourceListing"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySourceListing_sourceId_externalId_key" ON "OpportunitySourceListing"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySourceListing_sourceId_normalizedSourceUrl_key" ON "OpportunitySourceListing"("sourceId", "normalizedSourceUrl");

-- CreateIndex
CREATE INDEX "OpportunitySyncRun_sourceId_startedAt_idx" ON "OpportunitySyncRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "OpportunitySyncRun_status_idx" ON "OpportunitySyncRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityDuplicateReview_sourceListingId_key" ON "OpportunityDuplicateReview"("sourceListingId");

-- CreateIndex
CREATE INDEX "OpportunityDuplicateReview_probableMatchOpportunityId_resol_idx" ON "OpportunityDuplicateReview"("probableMatchOpportunityId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "OpportunitySourceListing" ADD CONSTRAINT "OpportunitySourceListing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OpportunitySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySourceListing" ADD CONSTRAINT "OpportunitySourceListing_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySyncRun" ADD CONSTRAINT "OpportunitySyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OpportunitySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDuplicateReview" ADD CONSTRAINT "OpportunityDuplicateReview_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES "OpportunitySourceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDuplicateReview" ADD CONSTRAINT "OpportunityDuplicateReview_candidateOpportunityId_fkey" FOREIGN KEY ("candidateOpportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDuplicateReview" ADD CONSTRAINT "OpportunityDuplicateReview_probableMatchOpportunityId_fkey" FOREIGN KEY ("probableMatchOpportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
