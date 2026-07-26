import { Router } from "express";
import { createBlueprintSchema, generatePaperSchema } from "@nvei/shared";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as blueprintService from "../services/blueprint.service.js";
import * as adminService from "../services/admin.service.js";
import { subjectRepository } from "../repositories/subject.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { evaluationQueue } from "../workers/queues.js";
import { evaluationResultRepository } from "../repositories/evaluationResult.repository.js";
import * as airService from "../services/air.service.js";

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRole("ADMIN"));

adminRoutes.get("/subjects", async (_req, res, next) => {
  try {
    res.json(await subjectRepository.listAll());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/overview", async (_req, res, next) => {
  try {
    res.json(await adminService.getOverview());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/centers", async (_req, res, next) => {
  try {
    res.json(await adminService.getCenters());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/schedule", async (_req, res, next) => {
  try {
    res.json(await adminService.getSchedule());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/security-events", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await adminService.getSecurityEvents(take));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/system-health", async (_req, res, next) => {
  try {
    res.json(await adminService.getSystemHealth());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/blockchain-events", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await adminService.getBlockchainEvents(take));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/audit-log", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await auditLogRepository.listPage({ take }));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post("/blueprints", async (req, res, next) => {
  try {
    const input = createBlueprintSchema.parse(req.body);
    res.status(201).json(await blueprintService.createBlueprint(input));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post("/blueprints/:id/publish", async (req, res, next) => {
  try {
    res.json(await blueprintService.publishBlueprint(req.auth!.userId, req.params.id));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/blueprints", async (_req, res, next) => {
  try {
    res.json(await blueprintService.listBlueprints());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/blueprints/:id", async (req, res, next) => {
  try {
    res.json(await blueprintService.getBlueprint(req.params.id));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post("/papers/generate", async (req, res, next) => {
  try {
    const input = generatePaperSchema.parse(req.body);
    res.status(202).json(await blueprintService.generatePaper(input));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/papers/:id", async (req, res, next) => {
  try {
    res.json(await blueprintService.getPaper(req.params.id));
  } catch (err) {
    next(err);
  }
});

// The "pipeline" view is the same data as /papers/:id for now — status plus
// the fields populated so far (storageRoot, chainTxHash, midenNoteId). A
// richer stage-by-stage timeline (mirroring the WS `paper:{id}:status`
// events into persisted rows) is a Phase 4 refinement, not a blocker.
adminRoutes.get("/papers/:id/pipeline", async (req, res, next) => {
  try {
    res.json(await blueprintService.getPaper(req.params.id));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post("/evaluation/run", async (req, res, next) => {
  try {
    const { paperId } = req.body as { paperId?: string };
    if (!paperId) return res.status(400).json({ error: "paperId is required" });
    const job = await evaluationQueue.add("evaluate", { paperId });
    res.status(202).json({ jobId: job.id ?? paperId });
  } catch (err) {
    next(err);
  }
});

// Per-session evaluation detail — live stage comes over WS
// (`evaluation:{sessionId}:status`); this is the settled-state read.
adminRoutes.get("/evaluation/:sessionId/pipeline", async (req, res, next) => {
  try {
    const result = await evaluationResultRepository.findByPaperAndSession(req.params.sessionId);
    res.json(result ?? { evaluated: false });
  } catch (err) {
    next(err);
  }
});

adminRoutes.post("/air/publish", async (req, res, next) => {
  try {
    const { paperId, tieBreakRule } = req.body as { paperId?: string; tieBreakRule?: string };
    if (!paperId) return res.status(400).json({ error: "paperId is required" });
    res.status(201).json(await airService.publishAIR(paperId, tieBreakRule ?? "earlier submission wins"));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get("/air/:paperId", async (req, res, next) => {
  try {
    res.json(await airService.getAIR(req.params.paperId));
  } catch (err) {
    next(err);
  }
});
