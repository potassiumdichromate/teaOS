/*
  Warnings:

  - You are about to drop the column `midenNoteId` on the `Paper` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Paper" DROP COLUMN "midenNoteId",
ADD COLUMN     "timelockRef" TEXT;
