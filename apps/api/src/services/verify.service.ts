// Student Verification per docs/SYSTEM_ARCHITECTURE.md §5: every check is
// itemized and independently re-derived, never a single opaque boolean.
// Public, no login — see docs/API_REFERENCE.md. Each check either genuinely
// passes, genuinely fails, or is honestly reported unavailable (e.g. Miden)
// — nothing here is faked to make the response look more complete than the
// system's actual current state.
import type { VerifyResponse } from "@nvei/shared";
import { prisma } from "../lib/prisma.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { downloadVerified } from "../lib/zg-storage.js";
import { verifyTransaction } from "../lib/zg-chain.js";
import { decrypt, deriveSessionKey, sha256Hex, unpackEncryptedPayload } from "../lib/crypto.js";
import { midenBridge } from "../lib/miden-bridge.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { logger } from "../lib/logger.js";

function isSameCalendarDate(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export async function verifyStudentResult(applicationId: string, dobIso: string): Promise<VerifyResponse> {
  const empty: VerifyResponse = {
    identityMatch: false,
    answerHashMatch: false,
    submissionHashMatch: false,
    resultHashMatch: false,
    midenNoteValid: false,
    storageProofValid: false,
    chainTxValid: false,
    overallVerified: false,
    details: {},
  };

  const student = await prisma.studentProfile.findUnique({ where: { applicationId } });
  if (!student || !isSameCalendarDate(student.dob, new Date(dobIso))) {
    // Deliberately don't distinguish "no such applicationId" from "DOB
    // mismatch" in the response — that distinction would let someone
    // enumerate valid applicationIds by brute-forcing DOBs against the
    // error message alone.
    await auditLogRepository.write("VERIFICATION_CHECK", { metadata: { applicationId, result: "IDENTITY_MISMATCH" } });
    return empty;
  }

  const session = await sessionRepository.findLatestEvaluatedForStudent(student.id);
  if (!session || !session.result) {
    await auditLogRepository.write("VERIFICATION_CHECK", { metadata: { applicationId, result: "NO_EVALUATED_SESSION" } });
    return { ...empty, identityMatch: true };
  }

  const details: VerifyResponse["details"] = {
    submissionChainTx: session.chainTxHash ?? undefined,
    resultChainTx: session.result.chainTxHash ?? undefined,
    storageRoot: session.answerStorageRoot ?? undefined,
    midenNoteId: session.midenNoteId ?? undefined,
  };

  // ── Submission hash: recompute from the actual stored ciphertext ────────
  let submissionHashMatch = false;
  let storageProofValid = false;
  let answerHashMatch = false;
  if (session.answerStorageRoot && session.submissionHash) {
    try {
      const packed = await downloadVerified(session.answerStorageRoot); // throws if the Merkle proof doesn't verify
      storageProofValid = true;
      const key = deriveSessionKey(session.id);
      const plaintext = decrypt(unpackEncryptedPayload(packed), key);
      const recomputedHash = sha256Hex(plaintext);
      submissionHashMatch = `${recomputedHash}` === session.submissionHash;

      const submissionAnchor = await chainAnchorRepository.findByEntity("StudentExamSession", session.id);
      answerHashMatch = submissionAnchor?.dataHash === recomputedHash;
    } catch (err) {
      logger.warn({ sessionId: session.id, err }, "Submission storage proof or decryption failed during verification");
    }
  }

  // ── Result hash: recompute from the DB fields using the same formula ────
  const recomputedResultHash = sha256Hex(
    JSON.stringify({
      sessionId: session.id,
      rawScore: session.result.rawScore,
      correctCount: session.result.correctCount,
      incorrectCount: session.result.incorrectCount,
      unattemptedCount: session.result.unattemptedCount,
    }),
  );
  const resultHashMatchDb = recomputedResultHash === session.result.resultHash;
  // Both registries anchor against the same session entityId in our schema
  // (see docs/DATABASE.md ChainAnchor design) — SubmissionRegistry and
  // ResultRegistry rows are told apart by contractName, not entityId.
  const resultChainAnchor = await prisma.chainAnchor.findFirst({
    where: { contractName: "ResultRegistry", entityId: session.id },
  });
  const resultHashMatch = resultHashMatchDb && resultChainAnchor?.dataHash === recomputedResultHash;

  // ── Chain tx validity: re-fetched from the chain itself, not our mirror ─
  const chainTxValid =
    (session.chainTxHash ? await verifyTransaction(session.chainTxHash) : false) &&
    (session.result.chainTxHash ? await verifyTransaction(session.result.chainTxHash) : false);

  // ── Miden: honestly unavailable until the bridge is wired ───────────────
  let midenNoteValid = false;
  if (session.midenNoteId) {
    try {
      const status = await midenBridge.getNoteStatus(session.midenNoteId);
      midenNoteValid = status.status === "CONSUMED";
    } catch (err) {
      logger.warn({ sessionId: session.id, err }, "Miden note status check unavailable (bridge not yet wired)");
    }
  }

  const overallVerified =
    submissionHashMatch && answerHashMatch && resultHashMatch && storageProofValid && chainTxValid && midenNoteValid;

  await auditLogRepository.write("VERIFICATION_CHECK", {
    metadata: { applicationId, sessionId: session.id, overallVerified },
  });

  return {
    identityMatch: true,
    answerHashMatch,
    submissionHashMatch,
    resultHashMatch,
    midenNoteValid,
    storageProofValid,
    chainTxValid,
    overallVerified,
    details,
  };
}
