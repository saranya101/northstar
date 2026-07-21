-- CreateEnum
CREATE TYPE "ModuleSourceStatus" AS ENUM ('OFFICIAL_CURRENT', 'OFFICIAL_HISTORICAL', 'USER_ENTERED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ModuleEnrolmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InstructorRole" AS ENUM ('LECTURER', 'TUTOR', 'SEMINAR_INSTRUCTOR', 'TEACHING_ASSISTANT', 'COORDINATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ModuleColour" AS ENUM ('MINERAL', 'OCEAN', 'FOREST', 'AMBER', 'TERRACOTTA', 'INDIGO', 'SLATE', 'ROSE');

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "schoolId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicUnits" DECIMAL(5,2),
    "level" TEXT,
    "gradingBasis" TEXT,
    "officialUrl" TEXT,
    "sourceStatus" "ModuleSourceStatus" NOT NULL DEFAULT 'USER_ENTERED',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleOffering" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL DEFAULT 'DEFAULT',
    "gradingType" TEXT,
    "syllabusUrl" TEXT,
    "courseOutlineFileUrl" TEXT,
    "assessmentInformation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "schoolName" TEXT,
    "officialProfileUrl" TEXT,
    "officialEmail" TEXT,
    "biography" TEXT,
    "researchInterests" TEXT,
    "sourceStatus" "ModuleSourceStatus" NOT NULL DEFAULT 'USER_ENTERED',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorAssignment" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "role" "InstructorRole" NOT NULL DEFAULT 'LECTURER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModuleEnrolment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userSemesterId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "targetGrade" TEXT,
    "personalNotes" TEXT,
    "colour" "ModuleColour" NOT NULL DEFAULT 'MINERAL',
    "status" "ModuleEnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModuleEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Module_universityId_idx" ON "Module"("universityId");

-- CreateIndex
CREATE INDEX "Module_schoolId_idx" ON "Module"("schoolId");

-- CreateIndex
CREATE INDEX "Module_code_idx" ON "Module"("code");

-- CreateIndex
CREATE INDEX "Module_title_idx" ON "Module"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Module_universityId_code_key" ON "Module"("universityId", "code");

-- CreateIndex
CREATE INDEX "ModuleOffering_moduleId_idx" ON "ModuleOffering"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleOffering_academicTermId_idx" ON "ModuleOffering"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleOffering_moduleId_academicTermId_sectionLabel_key" ON "ModuleOffering"("moduleId", "academicTermId", "sectionLabel");

-- CreateIndex
CREATE INDEX "Instructor_universityId_idx" ON "Instructor"("universityId");

-- CreateIndex
CREATE INDEX "Instructor_fullName_idx" ON "Instructor"("fullName");

-- CreateIndex
CREATE INDEX "Instructor_officialEmail_idx" ON "Instructor"("officialEmail");

-- CreateIndex
CREATE INDEX "InstructorAssignment_offeringId_idx" ON "InstructorAssignment"("offeringId");

-- CreateIndex
CREATE INDEX "InstructorAssignment_instructorId_idx" ON "InstructorAssignment"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorAssignment_offeringId_instructorId_role_key" ON "InstructorAssignment"("offeringId", "instructorId", "role");

-- CreateIndex
CREATE INDEX "UserModuleEnrolment_userId_idx" ON "UserModuleEnrolment"("userId");

-- CreateIndex
CREATE INDEX "UserModuleEnrolment_userSemesterId_idx" ON "UserModuleEnrolment"("userSemesterId");

-- CreateIndex
CREATE INDEX "UserModuleEnrolment_status_idx" ON "UserModuleEnrolment"("status");

-- CreateIndex
CREATE INDEX "UserModuleEnrolment_offeringId_idx" ON "UserModuleEnrolment"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "UserModuleEnrolment_userId_offeringId_key" ON "UserModuleEnrolment"("userId", "offeringId");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleOffering" ADD CONSTRAINT "ModuleOffering_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleOffering" ADD CONSTRAINT "ModuleOffering_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorAssignment" ADD CONSTRAINT "InstructorAssignment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ModuleOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorAssignment" ADD CONSTRAINT "InstructorAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleEnrolment" ADD CONSTRAINT "UserModuleEnrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleEnrolment" ADD CONSTRAINT "UserModuleEnrolment_userSemesterId_fkey" FOREIGN KEY ("userSemesterId") REFERENCES "UserSemester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleEnrolment" ADD CONSTRAINT "UserModuleEnrolment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ModuleOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
