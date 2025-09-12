/*
  Warnings:

  - Added the required column `codePrefix` to the `ProblemLanguage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codeSuffix` to the `ProblemLanguage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `functionSignature` to the `ProblemLanguage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProblemLanguage" ADD COLUMN     "codePrefix" TEXT NOT NULL,
ADD COLUMN     "codeSuffix" TEXT NOT NULL,
ADD COLUMN     "functionSignature" TEXT NOT NULL;
