import { prisma } from "../lib/prisma.js";

export const examPCRepository = {
  listForCenter: (centerId: string) =>
    prisma.examPC.findMany({ where: { centerId }, orderBy: { machineCode: "asc" } }),

  upsertHeartbeat: (centerId: string, machineCode: string) =>
    prisma.examPC.upsert({
      where: { centerId_machineCode: { centerId, machineCode } },
      update: { healthStatus: "ONLINE", lastHeartbeatAt: new Date() },
      create: { centerId, machineCode, healthStatus: "ONLINE", lastHeartbeatAt: new Date() },
    }),
};
