CREATE TYPE "PreparationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED');

CREATE TABLE "ModuleWeekPreparation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userModuleEnrolmentId" TEXT NOT NULL,
    "teachingWeek" INTEGER NOT NULL,
    "materialStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notesStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "requiredWorkStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "practiceStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "questions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleWeekPreparation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleWeekPreparation_userModuleEnrolmentId_teachingWeek_key" ON "ModuleWeekPreparation"("userModuleEnrolmentId", "teachingWeek");
CREATE INDEX "ModuleWeekPreparation_userId_idx" ON "ModuleWeekPreparation"("userId");
CREATE INDEX "ModuleWeekPreparation_userId_teachingWeek_idx" ON "ModuleWeekPreparation"("userId", "teachingWeek");

ALTER TABLE "ModuleWeekPreparation" ADD CONSTRAINT "ModuleWeekPreparation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModuleWeekPreparation" ADD CONSTRAINT "ModuleWeekPreparation_userModuleEnrolmentId_fkey" FOREIGN KEY ("userModuleEnrolmentId") REFERENCES "UserModuleEnrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
