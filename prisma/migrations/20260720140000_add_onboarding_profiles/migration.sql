-- CreateEnum
CREATE TYPE "PreferredStudyPeriod" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Singapore',
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "country" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeType" TEXT,
    "durationYears" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semesterNumber" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "teachingStartDate" TIMESTAMP(3),
    "recessStartDate" TIMESTAMP(3),
    "recessEndDate" TIMESTAMP(3),
    "examStartDate" TIMESTAMP(3),
    "examEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAcademicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "expectedGraduationYear" INTEGER,
    "currentYearOfStudy" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAcademicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredStudyPeriod" "PreferredStudyPeriod" NOT NULL,
    "typicalSessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "maximumDailyStudyMinutes" INTEGER NOT NULL DEFAULT 240,
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSemester" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "targetSemesterGpa" DECIMAL(3,2),
    "currentCumulativeGpa" DECIMAL(3,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSemester_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "University_name_country_key" ON "University"("name", "country");

-- CreateIndex
CREATE INDEX "School_universityId_idx" ON "School"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "School_universityId_name_key" ON "School"("universityId", "name");

-- CreateIndex
CREATE INDEX "Programme_schoolId_idx" ON "Programme"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_schoolId_name_key" ON "Programme"("schoolId", "name");

-- CreateIndex
CREATE INDEX "AcademicTerm_universityId_idx" ON "AcademicTerm"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_universityId_academicYear_name_key" ON "AcademicTerm"("universityId", "academicYear", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserAcademicProfile_userId_key" ON "UserAcademicProfile"("userId");

-- CreateIndex
CREATE INDEX "UserAcademicProfile_universityId_idx" ON "UserAcademicProfile"("universityId");

-- CreateIndex
CREATE INDEX "UserAcademicProfile_schoolId_idx" ON "UserAcademicProfile"("schoolId");

-- CreateIndex
CREATE INDEX "UserAcademicProfile_programmeId_idx" ON "UserAcademicProfile"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPreference_userId_key" ON "StudyPreference"("userId");

-- CreateIndex
CREATE INDEX "UserSemester_userId_isActive_idx" ON "UserSemester"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserSemester_academicTermId_idx" ON "UserSemester"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSemester_userId_academicTermId_key" ON "UserSemester"("userId", "academicTermId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicProfile" ADD CONSTRAINT "UserAcademicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicProfile" ADD CONSTRAINT "UserAcademicProfile_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicProfile" ADD CONSTRAINT "UserAcademicProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicProfile" ADD CONSTRAINT "UserAcademicProfile_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPreference" ADD CONSTRAINT "StudyPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSemester" ADD CONSTRAINT "UserSemester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSemester" ADD CONSTRAINT "UserSemester_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
