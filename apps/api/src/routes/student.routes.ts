import { Router } from "express";
import { autosaveAnswerSchema, selfEnrollSchema } from "@nvei/shared";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as examService from "../services/exam.service.js";

export const studentRoutes = Router();

// Student login is the same shared /auth/login as every other role (see
// docs/API_REFERENCE.md) — no separate applicationId-based auth mechanism.
studentRoutes.use(requireAuth, requireRole("STUDENT"));

studentRoutes.post("/exam/enroll", async (req, res, next) => {
  try {
    const input = selfEnrollSchema.parse(req.body);
    res.status(201).json(await examService.enrollSelf(req.auth!.userId, input));
  } catch (err) {
    next(err);
  }
});

studentRoutes.get("/exam/session", async (req, res, next) => {
  try {
    res.json(await examService.getSessionView(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

studentRoutes.get("/exam/questions", async (req, res, next) => {
  try {
    const sessionId = String(req.query.sessionId ?? "");
    if (!sessionId) return res.status(400).json({ error: "sessionId query param is required" });
    res.json(await examService.getActiveQuestions(req.auth!.userId, sessionId));
  } catch (err) {
    next(err);
  }
});

studentRoutes.post("/exam/start", async (req, res, next) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    res.json(await examService.startExam(req.auth!.userId, sessionId));
  } catch (err) {
    next(err);
  }
});

studentRoutes.put("/exam/answers", async (req, res, next) => {
  try {
    const { sessionId, ...answer } = req.body as { sessionId?: string } & Record<string, unknown>;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const parsed = autosaveAnswerSchema.parse(answer);
    await examService.autosaveAnswer(req.auth!.userId, sessionId, parsed);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

studentRoutes.post("/exam/submit", async (req, res, next) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    res.json(await examService.submitExam(req.auth!.userId, sessionId));
  } catch (err) {
    next(err);
  }
});
