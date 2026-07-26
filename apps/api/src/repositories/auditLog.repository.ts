import type { AuditAction } from "@nvei/shared";
import { prisma } from "../lib/prisma.js";
import { publish } from "../ws/hub.js";

export const auditLogRepository = {
  // Publishing to the `admin:live-logs` WS channel from inside the
  // repository is a minor layering compromise (repositories are meant to be
  // pure Prisma wrappers elsewhere in this codebase) — accepted here as the
  // one choke point every audit write already passes through, rather than
  // updating every one of this repository's ~15 call sites to also publish.
  write: async (action: AuditAction, args: { userId?: string; questionId?: string; metadata: object }) => {
    const row = await prisma.auditLog.create({
      data: { action, userId: args.userId, questionId: args.questionId, metadata: args.metadata },
    });
    publish("admin:live-logs", { type: "audit", id: row.id, action: row.action, createdAt: row.createdAt });
    return row;
  },

  listPage: (args: { cursor?: string; take: number; action?: AuditAction }) =>
    prisma.auditLog.findMany({
      where: args.action ? { action: args.action } : undefined,
      orderBy: { createdAt: "desc" },
      take: args.take,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    }),

  /** Rows created since the last audit-batch anchor — feeds the AuditLogRegistry Merkle-root worker. */
  findUnanchored: (take = 500) =>
    prisma.auditLog.findMany({ where: { batchAnchorId: null }, orderBy: { createdAt: "asc" }, take }),

  markAnchored: (ids: string[], batchAnchorId: string) =>
    prisma.auditLog.updateMany({ where: { id: { in: ids } }, data: { batchAnchorId } }),
};
