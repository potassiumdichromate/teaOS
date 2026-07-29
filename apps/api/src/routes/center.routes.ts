import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as centerService from "../services/center.service.js";

export const centerRoutes = Router();

// Center authentication is the same shared /auth/login as every other role
// (see docs/API_REFERENCE.md) — a center account is just a User with role
// CENTER, no separate credential mechanism.
centerRoutes.use(requireAuth, requireRole("CENTER"));

centerRoutes.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await centerService.getDashboard(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

centerRoutes.post("/pcs/:id/heartbeat", async (req, res, next) => {
  try {
    // :id is the exam PC's own machine code — PCs self-register on first
    // heartbeat rather than needing a pre-provisioned database id.
    res.json(await centerService.heartbeat(req.auth!.userId, req.params.id));
  } catch (err) {
    next(err);
  }
});

centerRoutes.get("/authorization/:paperId", async (req, res, next) => {
  try {
    res.json(await centerService.checkAuthorization(req.params.paperId));
  } catch (err) {
    next(err);
  }
});
