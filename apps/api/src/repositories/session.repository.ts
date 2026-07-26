import { prisma } from "../lib/prisma.js";

export const sessionRepository = {
  create: (args: { studentId: string; paperId: string; centerId: string; randomizationSeed: string }) =>
    prisma.studentExamSession.create({ data: { ...args, status: "NOT_STARTED" } }),

  countForCenter: (centerId: string) => prisma.studentExamSession.count({ where: { centerId } }),

  findCurrentForStudent: (studentId: string) =>
    prisma.studentExamSession.findFirst({
      where: { studentId, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      orderBy: { id: "desc" },
      include: { paper: { include: { paperQuestions: { include: { question: true } } } } },
    }),

  findById: (id: string) =>
    prisma.studentExamSession.findUnique({
      where: { id },
      include: { paper: true },
    }),

  listSubmittedForPaper: (paperId: string) =>
    prisma.studentExamSession.findMany({
      where: { paperId, status: "SUBMITTED" },
      include: { student: true },
    }),

  markEvaluated: (id: string) => prisma.studentExamSession.update({ where: { id }, data: { status: "EVALUATED" } }),

  findLatestEvaluatedForStudent: (studentId: string) =>
    prisma.studentExamSession.findFirst({
      where: { studentId, status: "EVALUATED" },
      orderBy: { submittedAt: "desc" },
      include: { result: { include: { airRanking: true } }, paper: true },
    }),

  markInProgress: (id: string) =>
    prisma.studentExamSession.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date() } }),

  markSubmitted: (
    id: string,
    args: { answerStorageRoot: string; submissionHash: string; chainTxHash: string; midenNoteId?: string },
  ) =>
    prisma.studentExamSession.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), ...args },
    }),
};
