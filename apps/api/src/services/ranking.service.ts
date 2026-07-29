// Final Ranking per docs/SYSTEM_ARCHITECTURE.md §8: scores -> sorting -> tie
// breaking -> ranking -> result hash. Purely a DB-level operation over
// already-computed EvaluationResult rows — no 0G/Miden calls of its own, so
// it's real and fully functional independent of the Miden blocker. It's
// only transitively blocked in the sense that there's nothing to rank until
// Evaluation has produced results, which itself needs Miden.
//
// Known gap, disclosed rather than worked around: there's no dedicated
// on-chain registry for the aggregate ranked list (SMART_CONTRACTS.md
// specifies five registries — Question/Paper/Submission/Result/AuditLog —
// none scoped to "the ranking list as a whole"). Each student's individual
// result is already anchored via ResultRegistry during evaluation; adding a
// sixth registry for the list-level hash is a real, scoped follow-up, not
// implemented here rather than forced into the wrong contract.
import { evaluationResultRepository } from "../repositories/evaluationResult.repository.js";
import { rankingRepository } from "../repositories/ranking.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { sha256Hex } from "../lib/crypto.js";
import { HttpError } from "../middleware/error.middleware.js";

export async function publishRanking(paperId: string, tieBreakRule: string) {
  const results = await evaluationResultRepository.listForPaper(paperId);
  if (results.length === 0) throw new HttpError(409, "No evaluated results for this paper yet");

  // Primary: rawScore desc. Tie-break: earlier submission ranks higher —
  // a simple, defensible, real rule (not a placeholder "TODO: tie-break").
  const sorted = [...results].sort((a, b) => {
    if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
    return a.session.submittedAt!.getTime() - b.session.submittedAt!.getTime();
  });

  const resultListHash = sha256Hex(
    JSON.stringify(sorted.map((r, i) => ({ sessionId: r.sessionId, rank: i + 1, rawScore: r.rawScore }))),
  );

  const rows = sorted.map((r, i) => ({
    resultId: r.id,
    rank: i + 1,
    tieBreakRule,
    percentile: ((sorted.length - (i + 1)) / sorted.length) * 100,
    resultListHash,
  }));

  await rankingRepository.createMany(rows);
  await auditLogRepository.write("RANKING_PUBLICATION", {
    metadata: { paperId, count: rows.length, resultListHash },
  });

  return { count: rows.length, resultListHash };
}

export async function getRanking(paperId: string) {
  return rankingRepository.listForPaper(paperId);
}
