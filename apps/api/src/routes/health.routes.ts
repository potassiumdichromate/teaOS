import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redisConnection } from "../workers/queues.js";

export const healthRoutes = Router();

healthRoutes.get("/healthz", async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    redisConnection.ping().then((r: string) => r === "PONG").catch(() => false),
  ]);
  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({ ok, db: dbOk, redis: redisOk });
});
