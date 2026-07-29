import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { listPrivacyCapableModels } from "../lib/zg-compute.js";
import * as computeService from "../services/compute.service.js";

export const computeRoutes = Router();
computeRoutes.use(requireAuth, requireRole("ADMIN", "OBSERVER"));

// Direct, stateless passthrough to 0G Compute's public /v1/models endpoint,
// useful for the Confidential Compute Dashboard to show which models
// currently have a TeeML provider.
computeRoutes.get("/privacy-models", async (_req, res, next) => {
  try {
    res.json({ models: await listPrivacyCapableModels() });
  } catch (err) {
    next(err);
  }
});

computeRoutes.get("/queue", async (_req, res, next) => {
  try {
    res.json(await computeService.getQueue());
  } catch (err) {
    next(err);
  }
});

computeRoutes.get("/attestations/:reportId", async (req, res, next) => {
  try {
    res.json(await computeService.getAttestation(req.params.reportId));
  } catch (err) {
    next(err);
  }
});

computeRoutes.get("/audit-log", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await computeService.getComputeAuditLog(take));
  } catch (err) {
    next(err);
  }
});
