/*
  Warnings:

  - You are about to drop the column `year` on the `Assessments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Assessments_status_idx";

-- AlterTable
ALTER TABLE "Assessments" DROP COLUMN "year",
ADD COLUMN     "batch" TEXT[];

-- CreateIndex
CREATE INDEX "Assessments_batch_idx" ON "Assessments"("batch");
