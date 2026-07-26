import type { CreateQuestionInput } from "@nvei/shared";
import { prisma } from "../lib/prisma.js";
import { questionRepository } from "../repositories/question.repository.js";
import { subjectRepository } from "../repositories/subject.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { validationQueue } from "../workers/queues.js";
import { HttpError } from "../middleware/error.middleware.js";

async function teacherProfileFor(userId: string) {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(403, "User is not a teacher");
  return profile;
}

export async function getDashboard(userId: string) {
  const profile = await teacherProfileFor(userId);
  const counts = await prisma.question.groupBy({
    by: ["status"],
    where: { teacherId: profile.id },
    _count: true,
  });
  return {
    teacherId: profile.id,
    fullName: profile.fullName,
    submissionCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  };
}

export async function listAssignedSubjects(userId: string) {
  await teacherProfileFor(userId);
  // Simplification for v1: returns every chapter of each assigned subject,
  // not the intersection with the teacher's individually assigned chapters —
  // acceptable for the MVP submission form, revisit if chapter-level
  // assignment scoping becomes a real requirement.
  return subjectRepository.listAssignedToTeacher(userId);
}

export async function listQuestions(userId: string) {
  const profile = await teacherProfileFor(userId);
  return questionRepository.listByTeacher(profile.id);
}

export async function getQuestionDetail(userId: string, questionId: string) {
  const profile = await teacherProfileFor(userId);
  const question = await questionRepository.findById(questionId);
  if (!question || question.teacherId !== profile.id) throw new HttpError(404, "Question not found");
  return question;
}

export async function createDraft(userId: string, input: CreateQuestionInput) {
  const profile = await teacherProfileFor(userId);
  return questionRepository.createDraft(profile.id, input);
}

export async function submitQuestion(userId: string, questionId: string): Promise<{ jobId: string }> {
  const profile = await teacherProfileFor(userId);
  const question = await questionRepository.findById(questionId);
  if (!question || question.teacherId !== profile.id) throw new HttpError(404, "Question not found");
  if (question.status !== "DRAFT") throw new HttpError(409, `Question is already ${question.status}`);

  await questionRepository.markSubmitted(questionId);
  await auditLogRepository.write("TEACHER_SUBMISSION", { userId, questionId, metadata: {} });

  const job = await validationQueue.add("validate", { questionId });
  return { jobId: job.id ?? questionId };
}
