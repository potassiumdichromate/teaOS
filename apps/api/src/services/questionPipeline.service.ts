// The Question Submission → On-Chain Anchor pipeline, exactly as specified in
// docs/SYSTEM_ARCHITECTURE.md §3. Runs inside the BullMQ worker, never inline
// on the request thread, because the 0G Compute + Storage + Chain round trips
// are too slow for a synchronous HTTP response.
import { AI_VALIDATION_THRESHOLDS } from "@nvei/shared";
import { questionRepository } from "../repositories/question.repository.js";
import { validationReportRepository } from "../repositories/validationReport.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { validateQuestion } from "../lib/zg-compute.js";
import { uploadEncrypted } from "../lib/zg-storage.js";
import { zgChain, toBytes32Id } from "../lib/zg-chain.js";
import { deriveQuestionKey, encrypt, packEncryptedPayload, sha256Hex } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../middleware/error.middleware.js";
import { publish } from "../ws/hub.js";

interface DraftPayload {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
  images: string[];
}

function passesThresholds(report: {
  duplicatePct: number;
  biasFlags: unknown[];
  grammarIssues: unknown[];
}): boolean {
  return (
    report.duplicatePct <= AI_VALIDATION_THRESHOLDS.maxDuplicatePct &&
    report.biasFlags.length <= AI_VALIDATION_THRESHOLDS.maxBiasFlags &&
    report.grammarIssues.length <= AI_VALIDATION_THRESHOLDS.maxGrammarIssues
  );
}

export async function runQuestionPipeline(questionId: string): Promise<void> {
  const question = await questionRepository.findById(questionId);
  if (!question) throw new HttpError(404, `Question ${questionId} not found`);
  // VALIDATING is accepted alongside SUBMITTED: real-world testing (not a
  // hypothetical) showed that once this function marks a question
  // VALIDATING and then fails partway through (e.g. 0G Compute unreachable),
  // BullMQ's automatic retry re-enters this function with the question
  // already in VALIDATING state — rejecting that as an invalid state would
  // turn every transient failure into a permanent stuck state instead of a
  // real retry.
  if (question.status !== "SUBMITTED" && question.status !== "VALIDATING") {
    throw new HttpError(409, `Question ${questionId} is not in SUBMITTED/VALIDATING state (currently ${question.status})`);
  }
  const draft = question.draftPayload as unknown as DraftPayload;

  if (question.status === "SUBMITTED") {
    await questionRepository.markValidating(questionId);
  }
  publish(`question:${questionId}:status`, { stage: "VALIDATING" });

  // ── Stage 1: AI validation (0G Compute, private trust mode / TEE) ───────
  const validation = await validateQuestion({
    text: draft.text,
    options: draft.options,
    explanation: draft.explanation,
    difficultySuggested: question.difficultySuggested,
    bloomLevelSuggested: question.bloomLevelSuggested,
  });

  const passed = passesThresholds(validation.report);

  await validationReportRepository.upsert(questionId, {
    report: validation.report,
    modelName: validation.modelName,
    providerAddress: validation.providerAddress ?? "unknown",
    trustMode: validation.trustMode,
    passedThresholds: passed,
  });
  await auditLogRepository.write("AI_VALIDATION", {
    questionId,
    metadata: { passed, trustMode: validation.trustMode, model: validation.modelName },
  });
  publish(`question:${questionId}:status`, { stage: "VALIDATED", passed });

  if (!passed) {
    await questionRepository.markRejected(questionId);
    publish(`question:${questionId}:status`, { stage: "REJECTED" });
    logger.info({ questionId }, "Question rejected by AI validation thresholds");
    return;
  }

  // ── Stage 2: encrypt ──────────────────────────────────────────────────
  const canonical = Buffer.from(JSON.stringify({ ...draft, subjectId: question.subjectId, chapterId: question.chapterId }));
  const contentHash = sha256Hex(canonical);
  const key = deriveQuestionKey(questionId);
  const packed = packEncryptedPayload(encrypt(canonical, key));
  await auditLogRepository.write("ENCRYPTION", { questionId, metadata: { contentHash } });
  publish(`question:${questionId}:status`, { stage: "ENCRYPTED" });

  // ── Stage 3: upload to 0G Storage ────────────────────────────────────
  const upload = await uploadEncrypted(packed);
  await auditLogRepository.write("STORAGE_UPLOAD", { questionId, metadata: { rootHash: upload.rootHash } });
  publish(`question:${questionId}:status`, { stage: "STORED", rootHash: upload.rootHash });

  // ── Stage 4: anchor on 0G Chain ───────────────────────────────────────
  const validationHash = sha256Hex(JSON.stringify(validation.report));
  const anchor = await zgChain.anchorQuestion(toBytes32Id(questionId), `0x${contentHash}`, `0x${validationHash}`);
  await chainAnchorRepository.record({
    contractName: "QuestionRegistry",
    entityType: "Question",
    entityId: questionId,
    dataHash: contentHash,
    txHash: anchor.txHash,
    blockNumber: BigInt(anchor.blockNumber),
  });
  await auditLogRepository.write("CHAIN_ANCHOR", { questionId, metadata: { txHash: anchor.txHash } });

  await questionRepository.markAccepted(questionId, {
    storageRoot: upload.rootHash,
    contentHash,
    chainTxHash: anchor.txHash,
    chainBlockNumber: BigInt(anchor.blockNumber),
  });
  publish(`question:${questionId}:status`, { stage: "ACCEPTED", txHash: anchor.txHash });
  logger.info({ questionId, txHash: anchor.txHash }, "Question pipeline complete — accepted and anchored");
}
