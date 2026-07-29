/*
  Warnings:

  - You are about to drop the `Center` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExamSchedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MidenNote` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'OBSERVER_LOGIN';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OBSERVER';

-- DropForeignKey
ALTER TABLE "Center" DROP CONSTRAINT "Center_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "ExamSchedule" DROP CONSTRAINT "ExamSchedule_paperId_fkey";

-- DropTable
DROP TABLE "Center";

-- DropTable
DROP TABLE "ExamSchedule";

-- DropTable
DROP TABLE "MidenNote";

-- DropEnum
DROP TYPE "MidenNotePurpose";

-- DropEnum
DROP TYPE "MidenNoteStatus";

-- CreateTable
CREATE TABLE "ObserverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "organization" TEXT,

    CONSTRAINT "ObserverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObserverProfile_userId_key" ON "ObserverProfile"("userId");

-- AddForeignKey
ALTER TABLE "ObserverProfile" ADD CONSTRAINT "ObserverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
