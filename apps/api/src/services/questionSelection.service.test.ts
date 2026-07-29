// Real Postgres (nvei_test), no mocking — this service only ever touches the
// DB, never 0G/drand, so there's nothing external to fake here.
import { describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createAcceptedQuestion, createSubjectAndChapter, createTeacher } from "../test/fixtures.js";
import { selectQuestionsForBlueprint } from "./questionSelection.service.js";

async function createBlueprint(subjectId: string, chapterId: string, questionCount: number, difficultyPct: Record<string, number>) {
  const blueprint = await prisma.blueprint.create({
    data: { title: "Test Blueprint", totalMarks: questionCount * 4, totalQuestions: questionCount, negativeMarking: 0.25 },
  });
  await prisma.blueprintSubjectAllocation.create({
    data: { blueprintId: blueprint.id, subjectId, questionCount, marksEach: 4 },
  });
  await prisma.blueprintChapterAllocation.create({
    data: { blueprintId: blueprint.id, chapterId, difficultyPct, questionCount },
  });
  return blueprint;
}

describe("selectQuestionsForBlueprint", () => {
  it("selects questions matching the AI-predicted difficulty, not the teacher's suggestion", async () => {
    const { subject, chapter } = await createSubjectAndChapter();
    const teacher = await createTeacher();
    // Teacher suggested EASY, but AI predicted MEDIUM — selection must key off the AI prediction.
    await prisma.question.create({
      data: {
        teacherId: teacher.id,
        subjectId: subject.id,
        chapterId: chapter.id,
        difficultySuggested: "EASY",
        bloomLevelSuggested: "APPLY",
        status: "ACCEPTED",
        storageRoot: "0xdeadbeef",
        contentHash: "abc",
        aiReport: {
          create: {
            duplicatePct: 5,
            similarQuestionIds: [],
            grammarIssues: [],
            biasFlags: [],
            difficultyPredicted: "MEDIUM",
            bloomLevelPredicted: "APPLY",
            topicClassified: "Kinematics",
            estimatedSolvingSeconds: 90,
            weightageSuggested: 1,
            modelName: "glm-5.2",
            providerAddress: "0xtest",
            trustMode: "private",
            passedThresholds: true,
          },
        },
      },
    });

    const blueprint = await createBlueprint(subject.id, chapter.id, 1, { EASY: 0, MEDIUM: 100, HARD: 0 });
    const selected = await selectQuestionsForBlueprint(blueprint.id);
    expect(selected).toHaveLength(1);
  });

  it("never fabricates questions to hit a target count — a shortfall stays a shortfall", async () => {
    const { subject, chapter } = await createSubjectAndChapter();
    const teacher = await createTeacher();
    await createAcceptedQuestion({ teacherId: teacher.id, subjectId: subject.id, chapterId: chapter.id, difficultyPredicted: "EASY" });

    // Ask for 5 EASY questions when only 1 exists.
    const blueprint = await createBlueprint(subject.id, chapter.id, 5, { EASY: 100, MEDIUM: 0, HARD: 0 });
    const selected = await selectQuestionsForBlueprint(blueprint.id);
    expect(selected).toHaveLength(1);
  });

  it("splits selection proportionally across difficulty bands within a chapter", async () => {
    const { subject, chapter } = await createSubjectAndChapter();
    const teacher = await createTeacher();
    for (let i = 0; i < 4; i++) {
      await createAcceptedQuestion({ teacherId: teacher.id, subjectId: subject.id, chapterId: chapter.id, difficultyPredicted: "EASY" });
    }
    for (let i = 0; i < 4; i++) {
      await createAcceptedQuestion({ teacherId: teacher.id, subjectId: subject.id, chapterId: chapter.id, difficultyPredicted: "HARD" });
    }

    // 10 questions, 40% EASY / 0% MEDIUM / 60% HARD -> 4 EASY, 6 HARD requested, only 4 HARD exist.
    const blueprint = await createBlueprint(subject.id, chapter.id, 10, { EASY: 40, MEDIUM: 0, HARD: 60 });
    const selected = await selectQuestionsForBlueprint(blueprint.id);
    expect(selected).toHaveLength(8); // 4 EASY (all matched) + 4 HARD (shortfall from 6 requested)
  });

  it("returns an empty selection for a chapter with no matching accepted questions", async () => {
    const { subject, chapter } = await createSubjectAndChapter();
    const blueprint = await createBlueprint(subject.id, chapter.id, 3, { EASY: 100, MEDIUM: 0, HARD: 0 });
    const selected = await selectQuestionsForBlueprint(blueprint.id);
    expect(selected).toHaveLength(0);
  });
});
