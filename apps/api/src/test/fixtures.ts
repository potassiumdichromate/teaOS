// Real-DB test fixtures (against the nvei_test database — see globalSetup.ts).
// No mocking of Postgres itself anywhere in this project's tests.
import { prisma } from "../lib/prisma.js";
import type { Difficulty } from "@nvei/shared";

export async function createSubjectAndChapter(namePrefix = "Physics") {
  const subject = await prisma.subject.create({ data: { name: `${namePrefix}-${crypto.randomUUID()}` } });
  const chapter = await prisma.chapter.create({ data: { subjectId: subject.id, name: "Mechanics" } });
  return { subject, chapter };
}

export async function createTeacher() {
  const user = await prisma.user.create({
    data: { email: `teacher-${crypto.randomUUID()}@example.dev`, passwordHash: "x", role: "TEACHER" },
  });
  return prisma.teacherProfile.create({ data: { userId: user.id, fullName: "Test Teacher" } });
}

export async function createStudent(applicationId: string, dob: Date) {
  const user = await prisma.user.create({
    data: { email: `student-${crypto.randomUUID()}@example.dev`, passwordHash: "x", role: "STUDENT" },
  });
  return prisma.studentProfile.create({
    data: { userId: user.id, applicationId, fullName: "Test Student", dob },
  });
}

export async function createCenter() {
  const user = await prisma.user.create({
    data: { email: `center-${crypto.randomUUID()}@example.dev`, passwordHash: "x", role: "CENTER" },
  });
  return prisma.centerProfile.create({
    data: { userId: user.id, centerCode: `CTR-${crypto.randomUUID().slice(0, 8)}`, name: "Test Center", address: "Test Address" },
  });
}

export async function createReadyPaper(overrides?: { examStartAt?: Date; examWindowCloseAt?: Date }) {
  const blueprint = await prisma.blueprint.create({
    data: { title: "Test Blueprint", totalMarks: 4, totalQuestions: 1, negativeMarking: 0.25 },
  });
  return prisma.paper.create({
    data: {
      blueprintId: blueprint.id,
      status: "READY",
      examStartAt: overrides?.examStartAt ?? new Date(Date.now() - 60_000),
      examWindowCloseAt: overrides?.examWindowCloseAt ?? new Date(Date.now() + 3_600_000),
    },
  });
}

export async function createAcceptedQuestion(args: {
  teacherId: string;
  subjectId: string;
  chapterId: string;
  difficultyPredicted: Difficulty;
}) {
  const question = await prisma.question.create({
    data: {
      teacherId: args.teacherId,
      subjectId: args.subjectId,
      chapterId: args.chapterId,
      difficultySuggested: args.difficultyPredicted,
      bloomLevelSuggested: "APPLY",
      status: "ACCEPTED",
      storageRoot: `0x${crypto.randomUUID().replace(/-/g, "")}`,
      contentHash: crypto.randomUUID().replace(/-/g, ""),
    },
  });
  await prisma.aIValidationReport.create({
    data: {
      questionId: question.id,
      duplicatePct: 10,
      similarQuestionIds: [],
      grammarIssues: [],
      biasFlags: [],
      difficultyPredicted: args.difficultyPredicted,
      bloomLevelPredicted: "APPLY",
      topicClassified: "Kinematics",
      estimatedSolvingSeconds: 90,
      weightageSuggested: 1,
      modelName: "glm-5.2",
      providerAddress: "0xtest",
      trustMode: "private",
      passedThresholds: true,
    },
  });
  return question;
}
