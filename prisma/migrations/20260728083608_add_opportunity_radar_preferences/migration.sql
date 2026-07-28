-- CreateEnum
CREATE TYPE "OpportunityFeedRefreshCadence" AS ENUM ('MANUAL', 'HOURLY', 'EVERY_6_HOURS', 'EVERY_12_HOURS', 'DAILY');

-- CreateEnum
CREATE TYPE "OpportunityDefaultSort" AS ENUM ('RECOMMENDED', 'NEWEST', 'DEADLINE', 'PORTFOLIO_VALUE');

-- CreateEnum
CREATE TYPE "OpportunityPortfolioGoal" AS ENUM ('LEADERSHIP', 'TECHNICAL_SKILLS', 'COMMUNITY_IMPACT', 'BUSINESS_EXPERIENCE', 'RESEARCH_EXPERIENCE', 'ENTREPRENEURSHIP', 'SCHOLARSHIP_EVIDENCE', 'TRANSFER_APPLICATION_EVIDENCE', 'NETWORKING', 'RESUME_BUILDING');

-- CreateTable
CREATE TABLE "OpportunityRadarPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedRefreshCadence" "OpportunityFeedRefreshCadence" NOT NULL DEFAULT 'EVERY_6_HOURS',
    "preferredSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredCategories" "OpportunityCategory"[] DEFAULT ARRAY[]::"OpportunityCategory"[],
    "preferredModes" "OpportunityMode"[] DEFAULT ARRAY[]::"OpportunityMode"[],
    "closingSoonDays" INTEGER NOT NULL DEFAULT 7,
    "defaultSort" "OpportunityDefaultSort" NOT NULL DEFAULT 'RECOMMENDED',
    "hideExpired" BOOLEAN NOT NULL DEFAULT true,
    "includeOther" BOOLEAN NOT NULL DEFAULT true,
    "portfolioGoals" "OpportunityPortfolioGoal"[] DEFAULT ARRAY[]::"OpportunityPortfolioGoal"[],
    "skillGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastManualRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityRadarPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityRadarPreference_userId_key" ON "OpportunityRadarPreference"("userId");

-- CreateIndex
CREATE INDEX "OpportunityRadarPreference_userId_idx" ON "OpportunityRadarPreference"("userId");

-- AddForeignKey
ALTER TABLE "OpportunityRadarPreference" ADD CONSTRAINT "OpportunityRadarPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
