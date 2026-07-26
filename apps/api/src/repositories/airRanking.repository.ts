import { prisma } from "../lib/prisma.js";

export const airRankingRepository = {
  createMany: (
    rows: { resultId: string; rank: number; tieBreakRule: string; percentile: number; resultListHash: string }[],
  ) => prisma.aIRRanking.createMany({ data: rows }),

  listForPaper: (paperId: string) =>
    prisma.aIRRanking.findMany({
      where: { result: { session: { paperId } } },
      include: { result: { include: { student: true } } },
      orderBy: { rank: "asc" },
    }),
};
