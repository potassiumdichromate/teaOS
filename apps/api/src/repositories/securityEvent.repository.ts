import { prisma } from "../lib/prisma.js";
import { publish } from "../ws/hub.js";

export const securityEventRepository = {
  write: async (args: {
    severity: "INFO" | "WARNING" | "CRITICAL";
    category: string;
    userId?: string;
    detail: object;
  }) => {
    const row = await prisma.securityEvent.create({ data: args });
    publish("admin:live-logs", { type: "security", id: row.id, severity: row.severity, category: row.category, createdAt: row.createdAt });
    return row;
  },

  listPage: (args: { take: number }) =>
    prisma.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: args.take }),
};
