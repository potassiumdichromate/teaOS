// Student Exam Client backend. The paper-decryption step is genuinely gated
// on the tlock timelock (lib/timelock.ts) — there is no backend override
// key, by design (see knowledge_base.md §3: "no administrator can download
// the paper"). Until a Paper's content key is actually unsealable (its
// drand round has been emitted), Paper.status can never reach READY, so
// startExam() below will correctly and honestly refuse to start any exam —
// that's the architecture working as intended, not a bug to route around.
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { chainAnchorRepository } from "../repositories/chainAnchor.repository.js";
import { downloadVerified, uploadEncrypted } from "../lib/zg-storage.js";
import { zgChain, toBytes32Id } from "../lib/zg-chain.js";
import {
  decrypt,
  deriveSessionKey,
  deriveStudentPhotoKey,
  encrypt,
  packEncryptedPayload,
  sha256Hex,
  unpackEncryptedPayload,
} from "../lib/crypto.js";
import { seededShuffle } from "../lib/shuffle.js";
import { unsealContentKey } from "../lib/timelock.js";
import { redisConnection } from "../workers/queues.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../middleware/error.middleware.js";

interface MasterPaperQuestion {
  questionId: string;
  subjectId: string;
  chapterId: string;
  marks: number;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
}

interface RedactedOption { text: string }
interface RedactedQuestion {
  questionId: string;
  subjectId: string;
  marks: number;
  text: string;
  options: RedactedOption[];
}

async function studentProfileFor(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(403, "User is not a student");
  return profile;
}

const answersKey = (sessionId: string) => `exam:${sessionId}:answers`;
const questionsCacheKey = (sessionId: string) => `exam:${sessionId}:questions`;

export async function getSessionView(userId: string) {
  const profile = await studentProfileFor(userId);
  const session = await sessionRepository.findCurrentForStudent(profile.id);
  if (!session) throw new HttpError(404, "No active exam session");

  return {
    sessionId: session.id,
    status: session.status,
    paperId: session.paperId,
    paperReady: session.paper.status === "READY",
    paperStatus: session.paper.status,
    examStartAt: session.paper.examStartAt,
    examWindowCloseAt: session.paper.examWindowCloseAt,
    questionCount: session.paper.paperQuestions.length,
    startedAt: session.startedAt,
  };
}

/**
 * Self-enrollment: moved here (2026-07-30) from center.service.ts's old
 * enrollStudent — a center operator no longer creates the session. The
 * student does, from their own portal, which is why applicationId is
 * re-checked against the caller's own profile below (not just "does this
 * applicationId exist anywhere") — otherwise any logged-in student could
 * enroll on behalf of a different candidate's applicationId. The optional
 * photo is a demo-grade identity capture only; see
 * docs/future-scale-implementation.md for the real face-verification plan
 * this stands in for.
 */
export async function enrollSelf(
  userId: string,
  args: { applicationId: string; paperId: string; photoDataUrl?: string },
) {
  const profile = await studentProfileFor(userId);
  if (args.applicationId !== profile.applicationId) {
    throw new HttpError(403, "That Application ID doesn't match your account");
  }

  const paper = await prisma.paper.findUnique({ where: { id: args.paperId } });
  if (!paper) throw new HttpError(404, "Paper not found");

  const existing = await prisma.studentExamSession.findUnique({
    where: { studentId_paperId: { studentId: profile.id, paperId: args.paperId } },
  });
  if (existing) throw new HttpError(409, "You're already enrolled for this paper");

  if (args.photoDataUrl) {
    const base64 = args.photoDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const raw = Buffer.from(base64, "base64");
    const key = deriveStudentPhotoKey(profile.applicationId);
    const packed = packEncryptedPayload(encrypt(raw, key));
    const upload = await uploadEncrypted(packed);
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { photoStorageRoot: upload.rootHash },
    });
  }

  const session = await sessionRepository.create({
    studentId: profile.id,
    paperId: args.paperId,
    randomizationSeed: randomBytes(16).toString("hex"),
  });
  await auditLogRepository.write("STUDENT_SELF_ENROLLED", {
    userId,
    metadata: { sessionId: session.id, applicationId: args.applicationId },
  });
  return session;
}

export async function startExam(userId: string, sessionId: string): Promise<RedactedQuestion[]> {
  const profile = await studentProfileFor(userId);
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.studentId !== profile.id) throw new HttpError(404, "Session not found");
  if (session.status !== "NOT_STARTED") throw new HttpError(409, `Session already ${session.status}`);
  if (session.paper.status !== "READY") {
    throw new HttpError(
      409,
      "Paper is not READY — the tlock key-timelock step hasn't completed yet (see lib/timelock.ts). " +
        "The exam cannot start because there is no backend override key, by design.",
    );
  }
  const now = new Date();
  if (now < session.paper.examStartAt) throw new HttpError(409, "Exam has not started yet");
  // Same upper bound center.service.ts's checkAuthorization already enforces
  // — found disagreeing between the two gates during the 2026-07-28 frontend
  // redesign pass (this one was missing it entirely), see knowledge_base.md
  // §11s and docs/PROJECT_ROADMAP.md item 6.
  if (now > session.paper.examWindowCloseAt) throw new HttpError(409, "Outside the exam time window — the paper's window has closed");
  if (!session.paper.timelockRef || !session.paper.storageRoot) {
    throw new HttpError(500, "Paper is READY but missing its timelock ref or storage root — inconsistent state");
  }

  let contentKey: Buffer;
  try {
    contentKey = await unsealContentKey(session.paper.timelockRef);
  } catch (err) {
    // Real, honest edge case: examStartAt has passed by the server's clock,
    // but drand's network hasn't confirmed the target round yet (can lag by
    // up to ~1 beacon period, ~3s — see lib/timelock.ts). Not a bug to hide.
    throw new HttpError(409, `Exam key not yet unlockable — try again in a few seconds: ${String(err)}`);
  }
  const packed = await downloadVerified(session.paper.storageRoot);
  const masterPaper = JSON.parse(decrypt(unpackEncryptedPayload(packed), contentKey).toString()) as {
    questions: MasterPaperQuestion[];
  };

  const orderedQuestions = seededShuffle(masterPaper.questions, session.randomizationSeed, "question-order");
  const redacted: RedactedQuestion[] = orderedQuestions.map((q) => ({
    questionId: q.questionId,
    subjectId: q.subjectId,
    marks: q.marks,
    text: q.text,
    options: seededShuffle(q.options, session.randomizationSeed, `options:${q.questionId}`).map((o) => ({
      text: o.text,
    })),
  }));

  // Full (unredacted) question set is cached server-side only, for
  // evaluation later — never sent to the client past this point.
  await redisConnection.set(
    questionsCacheKey(sessionId),
    JSON.stringify(orderedQuestions),
    "EX",
    7 * 24 * 60 * 60,
  );

  await sessionRepository.markInProgress(sessionId);
  await auditLogRepository.write("STUDENT_LOGIN", { userId, metadata: { sessionId, event: "exam_started" } });

  return redacted;
}

/**
 * Refresh-resilient resume: an IN_PROGRESS session's redacted question list
 * was already computed once in startExam() and cached server-side (Redis) —
 * re-derive the redacted view from that cache instead of re-unsealing the
 * tlock key or re-downloading/decrypting the master paper a second time.
 */
export async function getActiveQuestions(userId: string, sessionId: string): Promise<RedactedQuestion[]> {
  const profile = await studentProfileFor(userId);
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.studentId !== profile.id) throw new HttpError(404, "Session not found");
  if (session.status !== "IN_PROGRESS") throw new HttpError(409, `Session is ${session.status}, not IN_PROGRESS`);

  const cached = await redisConnection.get(questionsCacheKey(sessionId));
  if (!cached) throw new HttpError(410, "Question cache expired — this session can no longer be resumed");
  const orderedQuestions = JSON.parse(cached) as MasterPaperQuestion[];

  return orderedQuestions.map((q) => ({
    questionId: q.questionId,
    subjectId: q.subjectId,
    marks: q.marks,
    text: q.text,
    options: seededShuffle(q.options, session.randomizationSeed, `options:${q.questionId}`).map((o) => ({
      text: o.text,
    })),
  }));
}

export async function autosaveAnswer(
  userId: string,
  sessionId: string,
  answer: { questionId: string; selectedOptionIndex: number | null; markedForReview: boolean },
) {
  const profile = await studentProfileFor(userId);
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.studentId !== profile.id) throw new HttpError(404, "Session not found");
  if (session.status !== "IN_PROGRESS") throw new HttpError(409, `Session is ${session.status}, not IN_PROGRESS`);

  const key = deriveSessionKey(sessionId);
  const packed = packEncryptedPayload(encrypt(Buffer.from(JSON.stringify(answer)), key));
  await redisConnection.hset(answersKey(sessionId), answer.questionId, packed.toString("base64"));
}

export async function submitExam(userId: string, sessionId: string) {
  const profile = await studentProfileFor(userId);
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.studentId !== profile.id) throw new HttpError(404, "Session not found");
  if (session.status !== "IN_PROGRESS") throw new HttpError(409, `Session is ${session.status}, not IN_PROGRESS`);

  const key = deriveSessionKey(sessionId);
  const raw = await redisConnection.hgetall(answersKey(sessionId));
  const answers = Object.entries(raw).map(([questionId, b64]) => {
    const packed = Buffer.from(b64, "base64");
    const parsed = JSON.parse(decrypt(unpackEncryptedPayload(packed), key).toString()) as {
      selectedOptionIndex: number | null;
      markedForReview: boolean;
    };
    return { questionId, ...parsed };
  });

  const payload = Buffer.from(JSON.stringify({ sessionId, answers }));
  const submissionHash = sha256Hex(payload);
  const packedFinal = packEncryptedPayload(encrypt(payload, key));

  const upload = await uploadEncrypted(packedFinal);
  await auditLogRepository.write("ANSWER_SUBMISSION", { userId, metadata: { sessionId, rootHash: upload.rootHash } });

  const anchor = await zgChain.anchorSubmission(toBytes32Id(sessionId), `0x${submissionHash}`, toBytes32Id(session.paperId));
  await chainAnchorRepository.record({
    contractName: "SubmissionRegistry",
    entityType: "StudentExamSession",
    entityId: sessionId,
    dataHash: submissionHash,
    txHash: anchor.txHash,
    blockNumber: BigInt(anchor.blockNumber),
  });

  // Double-submission prevention no longer routes through a Miden note —
  // `zgChain.anchorSubmission` above already reverted on-chain if this
  // sessionId had ever been anchored before (SubmissionRegistry.sol:
  // `require(anchors[sessionId].blockTimestamp == 0)`), so reaching this
  // line at all is proof the commitment is fresh. See knowledge_base.md
  // §11q for why this real, already-deployed guarantee replaced the Miden
  // submission-note path (which was never actually wired — see §11d/§11n).
  await sessionRepository.markSubmitted(sessionId, {
    answerStorageRoot: upload.rootHash,
    submissionHash,
    chainTxHash: anchor.txHash,
  });

  await redisConnection.del(answersKey(sessionId));
  return { submitted: true, chainTxHash: anchor.txHash };
}
