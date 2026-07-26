// Paper Generation pipeline per docs/SYSTEM_ARCHITECTURE.md §4. Real through
// the 0G Storage/Chain steps; the Miden P2IDE timelock step honestly calls
// the still-unimplemented bridge (see docs/MIDEN_INTEGRATION.md "Verified API
// surface") and reports the failure rather than faking a READY status.
import { prisma } from "../lib/prisma.js";
import { paperRepository } from "../repositories/paper.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { selectQuestionsForBlueprint } from "./questionSelection.service.js";
import { downloadVerified, uploadEncrypted } from "../lib/zg-storage.js";
import { zgChain, toBytes32Id } from "../lib/zg-chain.js";
import { decrypt, deriveQuestionKey, encrypt, generateContentKey, packEncryptedPayload, sha256Hex, unpackEncryptedPayload } from "../lib/crypto.js";
import { midenBridge } from "../lib/miden-bridge.js";
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

  // ── Seal the content key behind a Miden P2IDE timelock ───────────────────
  publish(`paper:${paperId}:status`, { stage: "MIDEN_TIMELOCK" });
  try {
    const timelock = await midenBridge.createPaperKeyTimelock({
      wrappedKeyHex: contentKey.toString("hex"), // TODO: real key-wrapping once account provisioning lands, see MIDEN_INTEGRATION.md
      targetAccountId: "service-release-account", // placeholder pending real account bootstrapping
      timelockAt: paper.examStartAt.toISOString(),
      reclaimAt: paper.examWindowCloseAt.toISOString(),
    });
    await paperRepository.markReady(paperId, timelock.noteId);
    publish(`paper:${paperId}:status`, { stage: "READY", midenNoteId: timelock.noteId });
    logger.info({ paperId, noteId: timelock.noteId }, "Paper generation complete — Miden timelock sealed");
  } catch (err) {
    // Real, honest failure — the bridge is not wired yet (see MIDEN_INTEGRATION.md).
    // Storage + chain anchoring already succeeded and persisted above; the paper
    // simply cannot be marked READY (i.e. exam-startable) until the timelock exists.
    await auditLogRepository.write("PAPER_GENERATION", {
      metadata: { paperId, stage: "MIDEN_TIMELOCK_PENDING", error: String(err) },
    });
    publish(`paper:${paperId}:status`, { stage: "MIDEN_TIMELOCK_PENDING", error: String(err) });
    logger.warn({ paperId, err }, "Paper assembled and anchored, but Miden timelock is not yet available");
  }
}
