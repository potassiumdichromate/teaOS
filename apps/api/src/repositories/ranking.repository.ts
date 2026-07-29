import { prisma } from "../lib/prisma.js";

export const rankingRepository = {
  createMany: (
    rows: { resultId: string; rank: number; tieBreakRule: string; percentile: number; resultListHash: string }[],
  ) => prisma.rankingEntry.createMany({ data: rows }),

  listForPaper: (paperId: string) =>
    prisma.rankingEntry.findMany({
      where: { result: { session: { paperId } } },
      include: { result: { include: { student: true } } },
      orderBy: { rank: "asc" },
    }),
};
