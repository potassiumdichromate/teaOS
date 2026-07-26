import { prisma } from "../lib/prisma.js";

export const evaluationResultRepository = {
  create: (args: {
    sessionId: string;
    studentId: string;
    rawScore: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    resultHash: string;
    chainTxHash: string;
  }) => prisma.evaluationResult.create({ data: args }),

  listForPaper: (paperId: string) =>
    prisma.evaluationResult.findMany({
      where: { session: { paperId } },
      include: { session: true, student: true, airRanking: true },
    }),

  findByPaperAndSession: (sessionId: string) =>
    prisma.evaluationResult.findUnique({ where: { sessionId } }),
};
