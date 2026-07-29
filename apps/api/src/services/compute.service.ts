// Confidential Compute Dashboard — real data backing what were 501 stubs
// (see knowledge_base.md §12). Nothing here is synthesized: queue depth
// comes from BullMQ's own job-count API, attestation detail comes from the
// AIValidationReport row 0G Compute's own response populated, and the audit
// trail is the same append-only AuditLog every other dashboard reads.
import { prisma } from "../lib/prisma.js";
import { validationQueue } from "../workers/queues.js";
import { HttpError } from "../middleware/error.middleware.js";

export async function getQueue() {
  const [counts, pendingQuestions] = await Promise.all([
    validationQueue.getJobCounts(),
    prisma.question.findMany({
      where: { status: "VALIDATING" },
      select: { id: true, subjectId: true, chapterId: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
  ]);
  return { jobCounts: counts, pending: pendingQuestions };
}

export async function getAttestation(reportId: string) {
  const report = await prisma.aIValidationReport.findUnique({ where: { id: reportId } });
  if (!report) throw new HttpError(404, "No validation report with that id");
  // Only the attestation-relevant fields — never the question's own content,
  // which stays encrypted/off-Postgres per docs/DATABASE.md's design principle 1.
  return {
    id: report.id,
    questionId: report.questionId,
    modelName: report.modelName,
    providerAddress: report.providerAddress,
    trustMode: report.trustMode,
    attestationRef: report.attestationRef,
    passedThresholds: report.passedThresholds,
    createdAt: report.createdAt,
  };
}

export async function getComputeAuditLog(take: number) {
  return prisma.auditLog.findMany({
    where: { action: "AI_VALIDATION" },
    orderBy: { createdAt: "desc" },
    take,
  });
}
