/*
  Warnings:

  - A unique constraint covering the columns `[PhoneNumber]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "PhoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_PhoneNumber_key" ON "Student"("PhoneNumber");
