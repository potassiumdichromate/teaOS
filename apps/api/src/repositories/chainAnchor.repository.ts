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

  findByEntity: (entityType: string, entityId: string) =>
    prisma.chainAnchor.findFirst({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } }),

  listPage: (args: { take: number; entityType?: string }) =>
    prisma.chainAnchor.findMany({
      where: args.entityType ? { entityType: args.entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: args.take,
    }),
};
