// Read-only oversight surface for third-party auditors/reviewers (the
// government-reviewer/technical-auditor/policymaker audience named in
// knowledge_base.md §1). Every function here is a plain read — no service
// in this file ever calls a `.create`/`.update`/`.delete`, enforced also at
// the router level (routes/observer.routes.ts only ever registers GETs).
import { prisma } from "../lib/prisma.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";

// A real, currently-meaningful aggregate for an auditor: how much of the
// system's activity is actually anchored on-chain vs. merely recorded in
// Postgres. Not a re-verification of any single record (that's what the
// public /verify endpoint does, per-student) — this is the fleet-wide view.
export async function getIntegritySummary() {
  const [
    totalPapers,
    readyPapers,
    totalSessions,
    submittedOrEvaluatedSessions,
    totalEvaluationResults,
    resultAnchors,
    submissionAnchors,
    questionAnchors,
    paperAnchors,
    totalQuestionsAccepted,
  ] = await Promise.all([
    prisma.paper.count(),
    prisma.paper.count({ where: { status: "READY" } }),
    prisma.studentExamSession.count(),
    prisma.studentExamSession.count({ where: { status: { in: ["SUBMITTED", "EVALUATED"] } } }),
    prisma.evaluationResult.count(),
    prisma.chainAnchor.count({ where: { contractName: "ResultRegistry" } }),
    prisma.chainAnchor.count({ where: { contractName: "SubmissionRegistry" } }),
    prisma.chainAnchor.count({ where: { contractName: "QuestionRegistry" } }),
    prisma.chainAnchor.count({ where: { contractName: "PaperRegistry" } }),
    prisma.question.count({ where: { status: "ACCEPTED" } }),
  ]);

  return {
    papers: { total: totalPapers, ready: readyPapers, anchored: paperAnchors },
    questions: { accepted: totalQuestionsAccepted, anchored: questionAnchors },
    sessions: { total: totalSessions, submittedOrEvaluated: submittedOrEvaluatedSessions, anchored: submissionAnchors },
    evaluationResults: { total: totalEvaluationResults, anchored: resultAnchors },
  };
}

export async function getRecentChainAnchors(take: number) {
  return chainAnchorRepository.listPage({ take });
}
