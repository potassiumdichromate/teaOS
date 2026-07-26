import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { CreateQuestionInput } from "@nvei/shared";

export const questionRepository = {
  createDraft: (teacherId: string, input: CreateQuestionInput) =>
    prisma.question.create({
      data: {
        teacherId,
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        difficultySuggested: input.difficultySuggested,
        bloomLevelSuggested: input.bloomLevelSuggested,
        status: "DRAFT",
        draftPayload: {
          text: input.text,
          options: input.options,
          explanation: input.explanation,
          images: input.images,
        },
      },
    }),

  findById: (id: string) =>
    prisma.question.findUnique({ where: { id }, include: { aiReport: true, subject: true, chapter: true } }),

  listByTeacher: (teacherId: string) =>
    prisma.question.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" }, include: { aiReport: true } }),

  markSubmitted: (id: string) => prisma.question.update({ where: { id }, data: { status: "SUBMITTED" } }),

  markValidating: (id: string) => prisma.question.update({ where: { id }, data: { status: "VALIDATING" } }),

  markRejected: (id: string) => prisma.question.update({ where: { id }, data: { status: "REJECTED" } }),

  markAccepted: (id: string, args: { storageRoot: string; contentHash: string; chainTxHash: string; chainBlockNumber: bigint }) =>
    prisma.question.update({
      where: { id },
      data: { status: "ACCEPTED", draftPayload: Prisma.DbNull, ...args },
    }),

  clearDraftPayload: (id: string) => prisma.question.update({ where: { id }, data: { draftPayload: Prisma.DbNull } }),
};
