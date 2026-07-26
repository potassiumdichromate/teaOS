import { PrismaClient } from "@prisma/client";

// Standard singleton pattern so `tsx watch` hot-reloads don't exhaust the
// Postgres connection pool with a fresh PrismaClient per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
