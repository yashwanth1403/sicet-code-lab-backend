/*
  Warnings:

  - You are about to drop the column `employeeId` on the `Professor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[professorId]` on the table `Professor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `professorId` to the `Professor` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Professor_employeeId_idx";

-- DropIndex
DROP INDEX "Professor_employeeId_key";

-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "employeeId",
ADD COLUMN     "professorId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Professor_professorId_key" ON "Professor"("professorId");

-- CreateIndex
CREATE INDEX "Professor_professorId_idx" ON "Professor"("professorId");
