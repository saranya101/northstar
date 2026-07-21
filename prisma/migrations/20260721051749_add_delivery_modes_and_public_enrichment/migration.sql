-- CreateEnum
CREATE TYPE "SessionDeliveryMode" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID', 'TBC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ModuleVerificationStatus" AS ENUM ('USER_CONFIRMED', 'PUBLIC_SOURCE_MATCH', 'PUBLIC_SOURCE_CONFLICT', 'UNVERIFIED');

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "deliveryMode" "SessionDeliveryMode" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "enrichmentProvenance" JSONB,
ADD COLUMN     "verificationStatus" "ModuleVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
