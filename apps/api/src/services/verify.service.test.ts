// Real Postgres (nvei_test) + real crypto (encrypt/decrypt/hash all run for
// real). Only the network transport to 0G Storage/Chain is mocked here —
// the actual round-trip against real mainnet infra is already proven live
// and recorded in knowledge_base.md §11q; re-running that on every test run
// would need a funded wallet and would spend real gas, which is why it's
// excluded from the default (non-live) suite.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/zg-storage.js", () => ({ downloadVerified: vi.fn() }));
vi.mock("../lib/zg-chain.js", () => ({ verifyTransaction: vi.fn(), getSubmissionAnchor: vi.fn() }));

import { downloadVerified } from "../lib/zg-storage.js";
import { verifyTransaction, getSubmissionAnchor } from "../lib/zg-chain.js";
import { prisma } from "../lib/prisma.js";
import { deriveSessionKey, encrypt, packEncryptedPayload, sha256Hex } from "../lib/crypto.js";
import { createCenter, createReadyPaper, createStudent } from "../test/fixtures.js";
import { verifyStudentResult } from "./verify.service.js";

const mockedDownloadVerified = vi.mocked(downloadVerified);
const mockedVerifyTransaction = vi.mocked(verifyTransaction);
const mockedGetSubmissionAnchor = vi.mocked(getSubmissionAnchor);

beforeEach(() => {
  vi.clearAllMocks();
});

async function buildEvaluatedSession(applicationId: string, dob: Date) {
  const student = await createStudent(applicationId, dob);
  const center = await createCenter();
  const paper = await createReadyPaper();

  const answersPlaintext = Buffer.from(JSON.stringify({ answers: [] }), "utf8");

  const session = await prisma.studentExamSession.create({
    data: {
      studentId: student.id,
      paperId: paper.id,
      centerId: center.id,
      randomizationSeed: "seed",
      status: "EVALUATED",
      submittedAt: new Date(),
    },
  });

  // Real session-derived key (namespaced by the real session id, same as production).
  const realSessionKey = deriveSessionKey(session.id);
  const packed = packEncryptedPayload(encrypt(answersPlaintext, realSessionKey));
  const submissionHash = sha256Hex(answersPlaintext);

  await prisma.studentExamSession.update({
    where: { id: session.id },
    data: { answerStorageRoot: "0xfake-root", submissionHash, chainTxHash: "0xsubmit-tx" },
  });

  const result = await prisma.evaluationResult.create({
    data: {
      sessionId: session.id,
      studentId: student.id,
      rawScore: 4,
      correctCount: 1,
      incorrectCount: 0,
      unattemptedCount: 0,
      resultHash: sha256Hex(
        JSON.stringify({ sessionId: session.id, rawScore: 4, correctCount: 1, incorrectCount: 0, unattemptedCount: 0 }),
      ),
      chainTxHash: "0xresult-tx",
    },
  });

  await prisma.chainAnchor.create({
    data: {
      network: "ZG_MAINNET",
      contractName: "SubmissionRegistry",
      entityType: "StudentExamSession",
      entityId: session.id,
      dataHash: submissionHash,
      txHash: "0xsubmit-anchor-tx",
      blockNumber: 1n,
    },
  });
  await prisma.chainAnchor.create({
    data: {
      network: "ZG_MAINNET",
      contractName: "ResultRegistry",
      entityType: "StudentExamSession",
      entityId: session.id,
      dataHash: result.resultHash,
      txHash: "0xresult-anchor-tx",
      blockNumber: 2n,
    },
  });

  mockedDownloadVerified.mockResolvedValue(packed);
  mockedVerifyTransaction.mockResolvedValue(true);
  mockedGetSubmissionAnchor.mockResolvedValue({ submissionHash: `0x${submissionHash}` } as never);

  return { student, session, result };
}

describe("verifyStudentResult", () => {
  it("does not distinguish 'no such applicationId' from 'DOB mismatch' (anti-enumeration)", async () => {
    const a = await verifyStudentResult("NO-SUCH-APP", "2000-01-01");
    const student = await createStudent("APP-REAL", new Date("2000-01-01"));
    const b = await verifyStudentResult(student.applicationId, "1999-01-01"); // wrong DOB
    expect(a).toEqual(b);
    expect(a.identityMatch).toBe(false);
  });

  it("confirms identity but returns no further checks when there's no evaluated session", async () => {
    const student = await createStudent("APP-NOEVAL", new Date("2005-03-14"));
    const result = await verifyStudentResult(student.applicationId, "2005-03-14");
    expect(result.identityMatch).toBe(true);
    expect(result.overallVerified).toBe(false);
  });

  it("returns overallVerified: true when every independent check genuinely passes", async () => {
    const { student } = await buildEvaluatedSession("APP-FULL", new Date("2006-06-06"));
    const result = await verifyStudentResult(student.applicationId, "2006-06-06");
    expect(result).toMatchObject({
      identityMatch: true,
      submissionHashMatch: true,
      answerHashMatch: true,
      resultHashMatch: true,
      onChainCommitmentValid: true,
      storageProofValid: true,
      chainTxValid: true,
      overallVerified: true,
    });
  });

  it("flips overallVerified to false when the on-chain tx no longer verifies", async () => {
    const { student } = await buildEvaluatedSession("APP-BADTX", new Date("2007-07-07"));
    mockedVerifyTransaction.mockResolvedValue(false);
    const result = await verifyStudentResult(student.applicationId, "2007-07-07");
    expect(result.chainTxValid).toBe(false);
    expect(result.overallVerified).toBe(false);
  });

  it("flips overallVerified to false when the storage Merkle proof fails (download throws)", async () => {
    const { student } = await buildEvaluatedSession("APP-BADSTORAGE", new Date("2008-08-08"));
    mockedDownloadVerified.mockRejectedValue(new Error("merkle proof verification failed"));
    const result = await verifyStudentResult(student.applicationId, "2008-08-08");
    expect(result.storageProofValid).toBe(false);
    expect(result.submissionHashMatch).toBe(false);
    expect(result.overallVerified).toBe(false);
  });

  it("flips overallVerified to false when the on-chain commitment doesn't match", async () => {
    const { student } = await buildEvaluatedSession("APP-BADCOMMIT", new Date("2009-09-09"));
    mockedGetSubmissionAnchor.mockResolvedValue({ submissionHash: "0xsomething-else-entirely" } as never);
    const result = await verifyStudentResult(student.applicationId, "2009-09-09");
    expect(result.onChainCommitmentValid).toBe(false);
    expect(result.overallVerified).toBe(false);
  });
});
