-- AlterEnum
ALTER TYPE "PaperStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "failureReason" TEXT;
