// Covers the real bug found during the 2026-07-28 frontend redesign pass
// (knowledge_base.md §11s, docs/PROJECT_ROADMAP.md item 6): startExam()
// checked examStartAt but never examWindowCloseAt, while
// center.service.ts's checkAuthorization() correctly checked both — the two
// gates disagreed. Real Postgres (nvei_test) + real Redis (the actual local
// container); only the network calls to 0G Storage/drand are mocked, same
// boundary as verify.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/zg-storage.js", () => ({ downloadVerified: vi.fn(), uploadEncrypted: vi.fn() }));
vi.mock("../lib/timelock.js", () => ({ unsealContentKey: vi.fn(), sealContentKey: vi.fn() }));

import { downloadVerified } from "../lib/zg-storage.js";
import { unsealContentKey } from "../lib/timelock.js";
import { prisma } from "../lib/prisma.js";
import { encrypt, generateContentKey, packEncryptedPayload } from "../lib/crypto.js";
import { createCenter, createReadyPaper, createStudent } from "../test/fixtures.js";
import { startExam } from "./exam.service.js";

const mockedDownloadVerified = vi.mocked(downloadVerified);
const mockedUnsealContentKey = vi.mocked(unsealContentKey);

beforeEach(() => {
  vi.clearAllMocks();
});

async function createSession(paperOverrides?: { examStartAt?: Date; examWindowCloseAt?: Date }) {
  const student = await createStudent(`APP-${crypto.randomUUID().slice(0, 8)}`, new Date("2005-01-01"));
  const center = await createCenter();
  const paper = await createReadyPaper(paperOverrides);
  await prisma.paper.update({
    where: { id: paper.id },
    data: { timelockRef: "fake-tlock-ref", storageRoot: "0xfake-root" },
  });
  const session = await prisma.studentExamSession.create({
    data: {
      studentId: student.id,
      paperId: paper.id,
      centerId: center.id,
      randomizationSeed: "seed",
      status: "NOT_STARTED",
    },
  });
  return { student, session };
}

describe("startExam — exam time window gate", () => {
  it("refuses to start before examStartAt", async () => {
    const { student, session } = await createSession({
      examStartAt: new Date(Date.now() + 3_600_000), // starts an hour from now
      examWindowCloseAt: new Date(Date.now() + 7_200_000),
    });
    await expect(startExam(student.userId, session.id)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("not started"),
    });
  });

  it("refuses to start after examWindowCloseAt has passed — the fixed bug", async () => {
    const { student, session } = await createSession({
      examStartAt: new Date(Date.now() - 7_200_000),
      examWindowCloseAt: new Date(Date.now() - 3_600_000), // window closed an hour ago
    });
    await expect(startExam(student.userId, session.id)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Outside the exam time window"),
    });
    // Must never have reached the unseal step for an out-of-window exam.
    expect(mockedUnsealContentKey).not.toHaveBeenCalled();
  });

  it("succeeds inside the real exam window, matching center.service.ts's checkAuthorization bounds exactly", async () => {
    const { student, session } = await createSession(); // default: started 1 min ago, closes in 1 hour

    const contentKey = generateContentKey();
    const masterPaper = { questions: [{ questionId: "q1", subjectId: "s1", chapterId: "c1", marks: 4, text: "2+2?", options: [{ text: "4", isCorrect: true }, { text: "5", isCorrect: false }], explanation: "" }] };
    mockedUnsealContentKey.mockResolvedValue(contentKey);
    mockedDownloadVerified.mockResolvedValue(
      packEncryptedPayload(encrypt(Buffer.from(JSON.stringify(masterPaper), "utf8"), contentKey)),
    );

    const redacted = await startExam(student.userId, session.id);
    expect(redacted).toHaveLength(1);
    expect(redacted[0].options.every((o) => !("isCorrect" in o))).toBe(true); // never leaks the answer key
  });
});
