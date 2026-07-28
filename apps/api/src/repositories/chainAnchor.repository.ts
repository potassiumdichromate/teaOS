import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export const chainAnchorRepository = {
  record: (args: {
    contractName: string;
    entityType: string;
    entityId: string;
    dataHash: string;
    txHash: string;
    blockNumber: bigint;
  }) =>
    prisma.chainAnchor.create({
      data: { network: env.ZG_NETWORK === "mainnet" ? "ZG_MAINNET" : "ZG_TESTNET", ...args },
    }),

  // contractName is required, not optional: SubmissionRegistry and
  // ResultRegistry rows share the same (entityType, entityId) by design (see
  // verify.service.ts) — omitting it let `orderBy createdAt desc` silently
  // return whichever anchor was written most recently, which for any
  // evaluated session is always the ResultRegistry row, not the
  // SubmissionRegistry one a caller asking about the submission actually
  // wants. Found by actually running Evaluation end-to-end for the first
  // time (2026-07-28) and seeing answerHashMatch false when it shouldn't be.
  findByEntity: (entityType: string, entityId: string, contractName: string) =>
    prisma.chainAnchor.findFirst({ where: { entityType, entityId, contractName }, orderBy: { createdAt: "desc" } }),

  listPage: (args: { take: number; entityType?: string }) =>
    prisma.chainAnchor.findMany({
      where: args.entityType ? { entityType: args.entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: args.take,
    }),
};
