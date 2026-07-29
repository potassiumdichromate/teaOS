-- CreateEnum
CREATE TYPE "DuplicationLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'STUDENT_SELF_ENROLLED';

-- DropForeignKey
ALTER TABLE "StudentExamSession" DROP CONSTRAINT "StudentExamSession_centerId_fkey";

-- AlterTable
ALTER TABLE "BlueprintChapterAllocation" ADD COLUMN     "maxDuplicationLevel" "DuplicationLevel" NOT NULL DEFAULT 'HIGH';

-- AlterTable
ALTER TABLE "StudentExamSession" ALTER COLUMN "centerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "photoStorageRoot" TEXT;

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CenterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
