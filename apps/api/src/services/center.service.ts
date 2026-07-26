import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { examPCRepository } from "../repositories/examPC.repository.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { paperRepository } from "../repositories/paper.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { HttpError } from "../middleware/error.middleware.js";

async function centerProfileFor(userId: string) {
  const profile = await prisma.centerProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(403, "User is not a center");
  return profile;
}

export async function getDashboard(userId: string) {
  const profile = await centerProfileFor(userId);
  const [pcs, studentsConnected] = await Promise.all([
    examPCRepository.listForCenter(profile.id),
    sessionRepository.countForCenter(profile.id),
  ]);
  return {
    centerCode: profile.centerCode,
    name: profile.name,
    exam_pcs: pcs,
    studentsConnected,
    onlinePCs: pcs.filter((p) => p.healthStatus === "ONLINE").length,
  };
}

export async function heartbeat(userId: string, machineCode: string) {
  const profile = await centerProfileFor(userId);
  return examPCRepository.upsertHeartbeat(profile.id, machineCode);
}

export async function checkAuthorization(paperId: string) {
  const paper = await paperRepository.findById(paperId);
  if (!paper) throw new HttpError(404, "Paper not found");
  const authorized = paper.status === "READY" && new Date() >= paper.examStartAt && new Date() <= paper.examWindowCloseAt;
  return {
    authorized,
    paperStatus: paper.status,
    examStartAt: paper.examStartAt,
    examWindowCloseAt: paper.examWindowCloseAt,
    reason: authorized
      ? undefined
      : paper.status !== "READY"
        ? "Paper is not READY — Miden key-timelock step hasn't completed (see docs/MIDEN_INTEGRATION.md)"
        : "Outside the exam time window",
  };
}

export async function enrollStudent(userId: string, args: { applicationId: string; paperId: string }) {
  const profile = await centerProfileFor(userId);
  const student = await prisma.studentProfile.findUnique({ where: { applicationId: args.applicationId } });
  if (!student) throw new HttpError(404, `No student with applicationId ${args.applicationId}`);

  const existing = await prisma.studentExamSession.findUnique({
    where: { studentId_paperId: { studentId: student.id, paperId: args.paperId } },
  });
  if (existing) throw new HttpError(409, "Student already enrolled for this paper");

  const session = await sessionRepository.create({
    studentId: student.id,
    paperId: args.paperId,
    centerId: profile.id,
    randomizationSeed: randomBytes(16).toString("hex"),
  });
  await auditLogRepository.write("CENTER_AUTHENTICATION", {
    userId,
    metadata: { event: "student_enrolled", sessionId: session.id, applicationId: args.applicationId },
  });
  return session;
}
