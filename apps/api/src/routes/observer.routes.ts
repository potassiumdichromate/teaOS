// Curated read-only oversight surface, separate from routes/admin.routes.ts
// on purpose: an external auditor/reviewer should never be one line away
// from a mutating admin endpoint. Every handler in this file is a GET.
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as adminService from "../services/admin.service.js";
import * as observerService from "../services/observer.service.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";

export const observerRoutes = Router();
observerRoutes.use(requireAuth, requireRole("OBSERVER", "ADMIN"));

observerRoutes.get("/overview", async (_req, res, next) => {
  try {
    res.json(await adminService.getOverview());
  } catch (err) {
    next(err);
  }
});

observerRoutes.get("/system-health", async (_req, res, next) => {
  try {
    res.json(await adminService.getSystemHealth());
  } catch (err) {
    next(err);
  }
});

observerRoutes.get("/integrity-summary", async (_req, res, next) => {
  try {
    res.json(await observerService.getIntegritySummary());
  } catch (err) {
    next(err);
  }
});

observerRoutes.get("/chain-anchors", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await observerService.getRecentChainAnchors(take));
  } catch (err) {
    next(err);
  }
});

observerRoutes.get("/security-events", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await adminService.getSecurityEvents(take));
  } catch (err) {
    next(err);
  }
});

observerRoutes.get("/audit-log", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await auditLogRepository.listPage({ take }));
  } catch (err) {
    next(err);
  }
});
