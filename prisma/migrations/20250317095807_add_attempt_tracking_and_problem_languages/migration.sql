/*
  Warnings:

  - You are about to drop the column `score` on the `TestCases` table. All the data in the column will be lost.
  - Added the required column `score` to the `Problems` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Problems" ADD COLUMN     "score" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TestCases" DROP COLUMN "score";

-- CreateTable
CREATE TABLE "AttemptTracker" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttemptTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemLanguage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starterCode" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttemptTracker_studentId_idx" ON "AttemptTracker"("studentId");

-- CreateIndex
CREATE INDEX "AttemptTracker_assessmentId_idx" ON "AttemptTracker"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptTracker_studentId_assessmentId_key" ON "AttemptTracker"("studentId", "assessmentId");

-- CreateIndex
CREATE INDEX "ProblemLanguage_problemId_idx" ON "ProblemLanguage"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemLanguage_name_problemId_key" ON "ProblemLanguage"("name", "problemId");

-- AddForeignKey
ALTER TABLE "AttemptTracker" ADD CONSTRAINT "AttemptTracker_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptTracker" ADD CONSTRAINT "AttemptTracker_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLanguage" ADD CONSTRAINT "ProblemLanguage_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
