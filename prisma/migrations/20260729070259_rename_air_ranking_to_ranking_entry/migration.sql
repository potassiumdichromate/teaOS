-- Hand-written, not `prisma migrate dev`-generated: this project targets
-- a global market, not just India, so "AIRRanking" ("All India Rank") and
-- the "AIR_PUBLICATION" audit action are renamed. A naive schema diff would
-- DROP and CREATE the table, destroying real historical ranking rows
-- published earlier this project (knowledge_base.md §11q). Using RENAME
-- instead preserves every row and its data untouched — only the names
-- change.

-- CreateTable rename
ALTER TABLE "AIRRanking" RENAME TO "RankingEntry";
ALTER TABLE "RankingEntry" RENAME CONSTRAINT "AIRRanking_pkey" TO "RankingEntry_pkey";
ALTER TABLE "RankingEntry" RENAME CONSTRAINT "AIRRanking_resultId_fkey" TO "RankingEntry_resultId_fkey";
ALTER INDEX "AIRRanking_resultId_key" RENAME TO "RankingEntry_resultId_key";

-- Enum value rename — real Postgres syntax for renaming one value in place,
-- not adding a new one and migrating rows.
ALTER TYPE "AuditAction" RENAME VALUE 'AIR_PUBLICATION' TO 'RANKING_PUBLICATION';
