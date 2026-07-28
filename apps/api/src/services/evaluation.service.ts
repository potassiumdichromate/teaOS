// Evaluation Engine per docs/SYSTEM_ARCHITECTURE.md §4/§8. Two independent
// halves worth distinguishing: decrypting a student's SUBMITTED answers
// needs only the session-derived key (no timelock involved, same as
// autosave), but scoring them requires the official master paper — which,
// like starting an exam, is genuinely gated on the tlock timelock. So this
// pipeline can decrypt every submission right now, but cannot score any of
// them until Paper.status reaches READY. That gate is enforced explicitly
// below, not glossed over.
import { paperRepository } from "../repositories/paper.repository.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { evaluationResultRepository } from "../repositories/evaluationResult.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { downloadVerified } from "../lib/zg-storage.js";
import { zgChain, toBytes32Id, computeApplicationKey } from "../lib/zg-chain.js";
import { decrypt, deriveSessionKey, sha256Hex, unpackEncryptedPayload } from "../lib/crypto.js";
import { unsealContentKey } from "../lib/timelock.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../middleware/error.middleware.js";
import { publish } from "../ws/hub.js";

interface MasterPaperQuestion {
  questionId: string;
  marks: number;
  options: { text: string; isCorrect: boolean }[];
}

interface SubmittedAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
  markedForReview: boolean;
}

export async function runEvaluationPipeline(paperId: string): Promise<void> {
  const paper = await paperRepository.findById(paperId);
  if (!paper) throw new HttpError(404, `Paper ${paperId} not found`);
  if (paper.status !== "READY") {
    throw new HttpError(
      409,
      "Paper is not READY — cannot evaluate against an official key that doesn't exist yet. " +
        "The tlock key-timelock step hasn't completed (see lib/timelock.ts).",
    );
  }
  if (!paper.timelockRef || !paper.storageRoot) {
    throw new HttpError(500, "Paper is READY but missing its timelock ref or storage root — inconsistent state");
  }

  const sessions = await sessionRepository.listSubmittedForPaper(paperId);
  if (sessions.length === 0) {
    logger.info({ paperId }, "No SUBMITTED sessions to evaluate");
    return;
  }

  // ── Official key: same unseal pattern as Student Exam Client ────────────
  const contentKey = await unsealContentKey(paper.timelockRef);
  const packed = await downloadVerified(paper.storageRoot);
  const masterPaper = JSON.parse(decrypt(unpackEncryptedPayload(packed), contentKey).toString()) as {
    questions: MasterPaperQuestion[];
  };
  const questionsById = new Map(masterPaper.questions.map((q) => [q.questionId, q]));

  const negativeMarking = paper.blueprint.negativeMarking;

  for (const session of sessions) {
    publish(`evaluation:${session.id}:status`, { stage: "RETRIEVING" });
    if (!session.answerStorageRoot) {
      logger.warn({ sessionId: session.id }, "Submitted session has no answerStorageRoot — skipping");
      continue;
    }

    const answersPacked = await downloadVerified(session.answerStorageRoot);
    const answersKey = deriveSessionKey(session.id);
    const { answers } = JSON.parse(
      decrypt(unpackEncryptedPayload(answersPacked), answersKey).toString(),
    ) as { answers: SubmittedAnswer[] };

    publish(`evaluation:${session.id}:status`, { stage: "SCORING" });
    let rawScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    for (const answer of answers) {
      const question = questionsById.get(answer.questionId);
      if (!question) continue;
      if (answer.selectedOptionIndex === null) {
        unattemptedCount++;
        continue;
      }
      const isCorrect = question.options[answer.selectedOptionIndex]?.isCorrect === true;
      if (isCorrect) {
        rawScore += question.marks;
        correctCount++;
      } else {
        rawScore -= question.marks * negativeMarking;
        incorrectCount++;
      }
    }

    const resultHash = sha256Hex(
      JSON.stringify({ sessionId: session.id, rawScore, correctCount, incorrectCount, unattemptedCount }),
    );

    publish(`evaluation:${session.id}:status`, { stage: "ANCHORING" });
    const applicationKey = computeApplicationKey(session.student.applicationId, session.student.dob.toISOString());
    const anchor = await zgChain.anchorResult(applicationKey, `0x${resultHash}`, toBytes32Id(session.id));
    await chainAnchorRepository.record({
      contractName: "ResultRegistry",
      entityType: "StudentExamSession",
      entityId: session.id,
      dataHash: resultHash,
      txHash: anchor.txHash,
      blockNumber: BigInt(anchor.blockNumber),
    });

    await evaluationResultRepository.create({
      sessionId: session.id,
      studentId: session.studentId,
      rawScore,
      correctCount,
      incorrectCount,
      unattemptedCount,
      resultHash,
      chainTxHash: anchor.txHash,
    });
    await sessionRepository.markEvaluated(session.id);
    await auditLogRepository.write("EVALUATION", {
      metadata: { sessionId: session.id, rawScore, txHash: anchor.txHash },
    });
    publish(`evaluation:${session.id}:status`, { stage: "DONE", rawScore });
  }

  logger.info({ paperId, count: sessions.length }, "Evaluation pipeline complete");
}
