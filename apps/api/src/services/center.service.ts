import { prisma } from "../lib/prisma.js";
import { examPCRepository } from "../repositories/examPC.repository.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { paperRepository } from "../repositories/paper.repository.js";
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
        ? "Paper is not READY — the tlock key-timelock step hasn't completed (see lib/timelock.ts)"
        : "Outside the exam time window",
  };
}
