// 0G Storage Explorer — real data backing what were 501 stubs (see
// knowledge_base.md §12). `getProof` performs an actual Merkle-proof-verified
// download against the live indexer (the same `downloadVerified` the
// Student Verification flow uses) — a genuine cryptographic check, not a
// DB-flag lookup.
import { prisma } from "../lib/prisma.js";
import { downloadVerified } from "../lib/zg-storage.js";
import { HttpError } from "../middleware/error.middleware.js";
import { logger } from "../lib/logger.js";

export interface StorageObjectRow {
  storageRoot: string;
  entityType: "Question" | "Paper" | "StudentExamSession";
  entityId: string;
  createdAt: Date;
}

export async function listObjects(take: number): Promise<StorageObjectRow[]> {
  const [questions, papers, sessions] = await Promise.all([
    prisma.question.findMany({
      where: { storageRoot: { not: null } },
      select: { id: true, storageRoot: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    prisma.paper.findMany({
      where: { storageRoot: { not: null } },
      select: { id: true, storageRoot: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    prisma.studentExamSession.findMany({
      where: { answerStorageRoot: { not: null } },
      select: { id: true, answerStorageRoot: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
      take,
    }),
  ]);

  const rows: StorageObjectRow[] = [
    ...questions.map((q) => ({ storageRoot: q.storageRoot!, entityType: "Question" as const, entityId: q.id, createdAt: q.updatedAt })),
    ...papers.map((p) => ({ storageRoot: p.storageRoot!, entityType: "Paper" as const, entityId: p.id, createdAt: p.updatedAt })),
    ...sessions.map((s) => ({
      storageRoot: s.answerStorageRoot!,
      entityType: "StudentExamSession" as const,
      entityId: s.id,
      createdAt: s.submittedAt ?? new Date(0),
    })),
  ];
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows.slice(0, take);
}

export async function getProof(rootHash: string) {
  const [question, paper, session] = await Promise.all([
    prisma.question.findFirst({ where: { storageRoot: rootHash }, select: { id: true } }),
    prisma.paper.findFirst({ where: { storageRoot: rootHash }, select: { id: true } }),
    prisma.studentExamSession.findFirst({ where: { answerStorageRoot: rootHash }, select: { id: true } }),
  ]);
  const owner = question
    ? { entityType: "Question", entityId: question.id }
    : paper
      ? { entityType: "Paper", entityId: paper.id }
      : session
        ? { entityType: "StudentExamSession", entityId: session.id }
        : null;
  if (!owner) throw new HttpError(404, "No known object references that storage root");

  try {
    const blob = await downloadVerified(rootHash); // throws if the Merkle proof doesn't verify or the root can't be found
    return { ...owner, storageRoot: rootHash, proofValid: true, sizeBytes: blob.length };
  } catch (err) {
    logger.warn({ rootHash, err }, "0G Storage proof verification failed");
    return { ...owner, storageRoot: rootHash, proofValid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
