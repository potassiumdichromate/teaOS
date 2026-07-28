import { prisma } from "../lib/prisma.js";

export const paperRepository = {
  create: (args: { blueprintId: string; examStartAt: Date; examWindowCloseAt: Date }) =>
    prisma.paper.create({ data: { ...args, status: "ASSEMBLING" } }),

  findById: (id: string) =>
    prisma.paper.findUnique({
      where: { id },
      include: { blueprint: true, paperQuestions: { include: { question: true } } },
    }),

  linkQuestions: (paperId: string, questions: { questionId: string; marks: number }[]) =>
    prisma.paperQuestion.createMany({
      data: questions.map((q) => ({ paperId, questionId: q.questionId, marks: q.marks })),
    }),

  recordAssembly: (
    id: string,
    args: { storageRoot: string; masterPaperHash: string; chainTxHash: string },
  ) => prisma.paper.update({ where: { id }, data: args }),

  markReady: (id: string, timelockRef: string) =>
    prisma.paper.update({ where: { id }, data: { status: "READY", timelockRef } }),

  markPending: (id: string) => prisma.paper.update({ where: { id }, data: { status: "PENDING" } }),
};
