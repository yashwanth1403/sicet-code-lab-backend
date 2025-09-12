-- DropForeignKey
ALTER TABLE "AttemptTracker" DROP CONSTRAINT "AttemptTracker_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "ProblemLanguage" DROP CONSTRAINT "ProblemLanguage_problemId_fkey";

-- DropForeignKey
ALTER TABLE "Problems" DROP CONSTRAINT "Problems_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "TestCases" DROP CONSTRAINT "TestCases_problemId_fkey";

-- AddForeignKey
ALTER TABLE "Problems" ADD CONSTRAINT "Problems_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCases" ADD CONSTRAINT "TestCases_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptTracker" ADD CONSTRAINT "AttemptTracker_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLanguage" ADD CONSTRAINT "ProblemLanguage_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
