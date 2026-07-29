import { prisma } from "../lib/prisma.js";
import type { CreateBlueprintInput } from "@nvei/shared";

export const blueprintRepository = {
  create: (input: CreateBlueprintInput) =>
    prisma.blueprint.create({
      data: {
        title: input.title,
        totalMarks: input.totalMarks,
        totalQuestions: input.totalQuestions,
        negativeMarking: input.negativeMarking,
        subjectAllocations: { create: input.subjectAllocations },
        chapterAllocations: {
          create: input.chapterAllocations.map((c) => ({
            chapterId: c.chapterId,
            difficultyPct: c.difficultyPct,
            questionCount: c.questionCount,
            maxDuplicationLevel: c.maxDuplicationLevel,
          })),
        },
      },
      include: { subjectAllocations: true, chapterAllocations: true },
    }),

  publish: (id: string) => prisma.blueprint.update({ where: { id }, data: { publishedAt: new Date() } }),

  listAll: () =>
    prisma.blueprint.findMany({
      orderBy: { createdAt: "desc" },
      include: { subjectAllocations: true, chapterAllocations: true, papers: true },
    }),

  findById: (id: string) =>
    prisma.blueprint.findUnique({
      where: { id },
      include: {
        subjectAllocations: { include: { subject: true } },
        chapterAllocations: { include: { chapter: true } },
      },
    }),
};
