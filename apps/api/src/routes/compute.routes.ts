import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { stub } from "./stub.helper.js";
import { listPrivacyCapableModels } from "../lib/zg-compute.js";

export const computeRoutes = Router();
computeRoutes.use(requireAuth, requireRole("ADMIN"));

// This one is real today — it's a direct, stateless passthrough to 0G Compute's
// public /v1/models endpoint, useful for the Confidential Compute Dashboard to
// show which models currently have a TeeML provider.
computeRoutes.get("/privacy-models", async (_req, res, next) => {
  try {
    res.json({ models: await listPrivacyCapableModels() });
  } catch (err) {
    next(err);
  }
});

stub(computeRoutes, "get", "/queue", "Confidential Compute Dashboard");
stub(computeRoutes, "get", "/attestations/:reportId", "Confidential Compute Dashboard");
stub(computeRoutes, "get", "/audit-log", "Confidential Compute Dashboard");
