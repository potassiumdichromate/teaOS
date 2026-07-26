import { prisma } from "../lib/prisma.js";
import type { Difficulty } from "@nvei/shared";

interface SelectedQuestion {
  questionId: string;
  marks: number;
}

/**
 * Greedy, per-chapter, difficulty-proportional selection from the ACCEPTED
 * pool. Uses the AI-predicted difficulty (AIValidationReport.difficultyPredicted)
 * rather than the teacher's suggestion, since that's the value the
 * validation pipeline actually corroborated. If fewer matching questions
 * exist than the blueprint asks for, this returns fewer — it never
 * fabricates questions to hit a target count. The caller decides whether a
 * shortfall is acceptable.
 */
export async function selectQuestionsForBlueprint(blueprintId: string): Promise<SelectedQuestion[]> {
  const blueprint = await prisma.blueprint.findUniqueOrThrow({
    where: { id: blueprintId },
    include: {
      subjectAllocations: true,
      chapterAllocations: { include: { chapter: true } },
    },
  });

  const marksBySubject = new Map(blueprint.subjectAllocations.map((s) => [s.subjectId, s.marksEach]));
  const selected: SelectedQuestion[] = [];

  for (const allocation of blueprint.chapterAllocations) {
    const pct = allocation.difficultyPct as Record<Difficulty, number>;
    const target = allocation.questionCount;
    const counts: Record<Difficulty, number> = {
      EASY: Math.round((target * (pct.EASY ?? 0)) / 100),
      MEDIUM: Math.round((target * (pct.MEDIUM ?? 0)) / 100),
      HARD: Math.round((target * (pct.HARD ?? 0)) / 100),
    };

    const marks = marksBySubject.get(allocation.chapter.subjectId) ?? 1;

    for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const) {
      const count = counts[difficulty];
      if (count <= 0) continue;
      const questions = await prisma.question.findMany({
        where: {
          chapterId: allocation.chapterId,
          status: "ACCEPTED",
          aiReport: { difficultyPredicted: difficulty },
        },
        take: count,
        orderBy: { createdAt: "asc" },
      });
      selected.push(...questions.map((q) => ({ questionId: q.id, marks })));
    }
  }

  return selected;
}
