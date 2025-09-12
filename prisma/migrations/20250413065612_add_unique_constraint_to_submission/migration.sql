/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `executionTime` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `memoryUsed` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `testResults` on the `Submission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,problemId]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "createdAt",
DROP COLUMN "errorMessage",
DROP COLUMN "executionTime",
DROP COLUMN "memoryUsed",
DROP COLUMN "testResults";

-- CreateIndex
CREATE UNIQUE INDEX "Submission_studentId_problemId_key" ON "Submission"("studentId", "problemId");
