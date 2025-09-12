-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CODING', 'MULTIPLE_CHOICE');

-- AlterTable
ALTER TABLE "Problems" ADD COLUMN     "questionType" "QuestionType" NOT NULL DEFAULT 'CODING';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "selectedChoiceId" TEXT,
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "language" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QuestionChoice" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionChoice_problemId_idx" ON "QuestionChoice"("problemId");

-- AddForeignKey
ALTER TABLE "QuestionChoice" ADD CONSTRAINT "QuestionChoice_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
