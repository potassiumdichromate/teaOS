// Paper Generation pipeline per docs/SYSTEM_ARCHITECTURE.md §4. Real end to
// end, including the timelock step: the content key is sealed via real
// drand/tlock (lib/timelock.ts) rather than the Miden P2IDE note this used
// to depend on — see knowledge_base.md §11o for why that switch happened.
import { prisma } from "../lib/prisma.js";
import { paperRepository } from "../repositories/paper.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { selectQuestionsForBlueprint } from "./questionSelection.service.js";
import { downloadVerified, uploadEncrypted } from "../lib/zg-storage.js";
import { zgChain, toBytes32Id } from "../lib/zg-chain.js";
import { decrypt, deriveQuestionKey, encrypt, generateContentKey, packEncryptedPayload, sha256Hex, unpackEncryptedPayload } from "../lib/crypto.js";
import { sealContentKey } from "../lib/timelock.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../middleware/error.middleware.js";
import { publish } from "../ws/hub.js";

export async function runPaperGenerationPipeline(paperId: string): Promise<void> {
  const paper = await paperRepository.findById(paperId);
  if (!paper) throw new HttpError(404, `Paper ${paperId} not found`);

  publish(`paper:${paperId}:status`, { stage: "SELECTING_QUESTIONS" });
  const selected = await selectQuestionsForBlueprint(paper.blueprintId);
  if (selected.length === 0) {
    throw new HttpError(
      409,
      `No ACCEPTED questions matched blueprint ${paper.blueprintId}'s chapter allocations — cannot assemble a paper from zero questions`,
    );
  }
  await paperRepository.linkQuestions(paperId, selected);
  await auditLogRepository.write("PAPER_GENERATION", { metadata: { stage: "SELECTED", count: selected.length } });

  // ── Decrypt each selected question and assemble the master paper ────────
  publish(`paper:${paperId}:status`, { stage: "ASSEMBLING" });
  const questions = await prisma.question.findMany({ where: { id: { in: selected.map((s) => s.questionId) } } });
  const marksByQuestion = new Map(selected.map((s) => [s.questionId, s.marks]));

  const assembled = await Promise.all(
    questions.map(async (q) => {
      if (!q.storageRoot) throw new HttpError(500, `Question ${q.id} is ACCEPTED but has no storageRoot`);
      const packed = await downloadVerified(q.storageRoot);
      const plaintext = decrypt(unpackEncryptedPayload(packed), deriveQuestionKey(q.id));
      const content = JSON.parse(plaintext.toString()) as { text: string; options: unknown; explanation: string };
      return {
        questionId: q.id,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        marks: marksByQuestion.get(q.id) ?? 1,
        ...content,
      };
    }),
  );

  const masterPaper = { blueprintId: paper.blueprintId, paperId, questions: assembled };
  const masterPaperBuffer = Buffer.from(JSON.stringify(masterPaper));
  const masterPaperHash = sha256Hex(masterPaperBuffer);
  const blueprintHash = sha256Hex(JSON.stringify(paper.blueprint));

  // ── Encrypt with a FRESH key (never derived, unlike per-question keys) ──
  const contentKey = generateContentKey();
  const packed = packEncryptedPayload(encrypt(masterPaperBuffer, contentKey));
  await auditLogRepository.write("ENCRYPTION", { metadata: { paperId, masterPaperHash } });

  publish(`paper:${paperId}:status`, { stage: "UPLOADING" });
  const upload = await uploadEncrypted(packed);
  await auditLogRepository.write("STORAGE_UPLOAD", { metadata: { paperId, rootHash: upload.rootHash } });

  publish(`paper:${paperId}:status`, { stage: "ANCHORING" });
  const anchor = await zgChain.anchorPaper(toBytes32Id(paperId), `0x${masterPaperHash}`, `0x${blueprintHash}`);
  await chainAnchorRepository.record({
    contractName: "PaperRegistry",
    entityType: "Paper",
    entityId: paperId,
    dataHash: masterPaperHash,
    txHash: anchor.txHash,
    blockNumber: BigInt(anchor.blockNumber),
  });
  await auditLogRepository.write("CHAIN_ANCHOR", { metadata: { paperId, txHash: anchor.txHash } });

  await paperRepository.recordAssembly(paperId, {
    storageRoot: upload.rootHash,
    masterPaperHash,
    chainTxHash: anchor.txHash,
  });

  // ── Seal the content key behind a real drand/tlock timelock ─────────────
  // (Formerly a Miden P2IDE note — replaced 2026-07-28, see knowledge_base.md
  // §11o. tlock has no "reclaim height" concept: it's pure IBE encryption,
  // not an asset-bearing note, so examWindowCloseAt isn't needed here — the
  // exam-window-close enforcement stays an app-level check elsewhere.)
  publish(`paper:${paperId}:status`, { stage: "TLOCK_SEAL" });
  try {
    const sealed = await sealContentKey(contentKey, paper.examStartAt);
    await paperRepository.markReady(paperId, sealed.ref);
    publish(`paper:${paperId}:status`, { stage: "READY", timelockRound: sealed.round });
    logger.info({ paperId, round: sealed.round }, "Paper generation complete — tlock timelock sealed");
  } catch (err) {
    // Storage + chain anchoring already succeeded and persisted above; the
    // paper simply cannot be marked READY (i.e. exam-startable) until the
    // seal succeeds. This should be rare (drand's HTTP API being briefly
    // unreachable) rather than the routine case the old Miden-pending path
    // was, since drand mainnet is live production infrastructure.
    await auditLogRepository.write("PAPER_GENERATION", {
      metadata: { paperId, stage: "TLOCK_SEAL_FAILED", error: String(err) },
    });
    publish(`paper:${paperId}:status`, { stage: "TLOCK_SEAL_FAILED", error: String(err) });
    logger.warn({ paperId, err }, "Paper assembled and anchored, but sealing the content key via tlock failed");
  }
}
