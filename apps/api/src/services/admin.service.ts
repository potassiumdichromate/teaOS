import { prisma } from "../lib/prisma.js";
import { securityEventRepository } from "../repositories/securityEvent.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { getChainBlockNumber } from "../lib/zg-chain.js";
import { redisConnection, validationQueue, paperGenerationQueue, evaluationQueue } from "../workers/queues.js";
import { env } from "../config/env.js";

export async function getOverview() {
  const [statusCounts, bySubject, byDifficulty, teacherActivity, totalTeachers, totalStudents] = await Promise.all([
    prisma.question.groupBy({ by: ["status"], _count: true }),
    prisma.question.groupBy({ by: ["subjectId"], _count: true }),
    prisma.aIValidationReport.groupBy({ by: ["difficultyPredicted"], _count: true }),
    prisma.question.groupBy({ by: ["teacherId"], _count: true, orderBy: { _count: { teacherId: "desc" } }, take: 5 }),
    prisma.teacherProfile.count(),
    prisma.studentProfile.count(),
  ]);

  const subjects = await prisma.subject.findMany({ where: { id: { in: bySubject.map((s) => s.subjectId) } } });
  const teachers = await prisma.teacherProfile.findMany({
    where: { id: { in: teacherActivity.map((t) => t.teacherId) } },
  });

  return {
    totalTeachers,
    totalStudents,
    questionsByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    questionsBySubject: bySubject.map((s) => ({
      subject: subjects.find((sub) => sub.id === s.subjectId)?.name ?? s.subjectId,
      count: s._count,
    })),
    questionsByDifficulty: byDifficulty.map((d) => ({ difficulty: d.difficultyPredicted, count: d._count })),
    teacherActivity: teacherActivity.map((t) => ({
      teacher: teachers.find((tc) => tc.id === t.teacherId)?.fullName ?? t.teacherId,
      count: t._count,
    })),
  };
}

export async function getCenters() {
  return prisma.centerProfile.findMany({
    include: { _count: { select: { examPCs: true, sessions: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getSchedule() {
  return prisma.paper.findMany({
    include: { blueprint: { select: { title: true } } },
    orderBy: { examStartAt: "asc" },
  });
}

export async function getSecurityEvents(take: number) {
  return securityEventRepository.listPage({ take });
}

export async function getBlockchainEvents(take: number) {
  const [anchors, midenNotes] = await Promise.all([
    chainAnchorRepository.listPage({ take }),
    prisma.midenNote.findMany({ orderBy: { createdAt: "desc" }, take }),
  ]);
  return { chainAnchors: anchors, midenNotes };
}

export async function getSystemHealth() {
  const [dbOk, redisOk, chainBlockNumber, validationCounts, paperCounts, evaluationCounts] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    redisConnection.ping().then((r: string) => r === "PONG").catch(() => false),
    getChainBlockNumber().catch(() => null),
    validationQueue.getJobCounts(),
    paperGenerationQueue.getJobCounts(),
    evaluationQueue.getJobCounts(),
  ]);

  return {
    network: env.ZG_NETWORK,
    db: dbOk,
    redis: redisOk,
    zgChain: { reachable: chainBlockNumber !== null, blockNumber: chainBlockNumber },
    queues: {
      questionValidation: validationCounts,
      paperGeneration: paperCounts,
      evaluation: evaluationCounts,
    },
  };
}
