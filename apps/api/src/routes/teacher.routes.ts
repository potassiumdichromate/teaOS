import { Router } from "express";
import { createQuestionSchema } from "@nvei/shared";
import * as teacherService from "../services/teacher.service.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

export const teacherRoutes = Router();
teacherRoutes.use(requireAuth, requireRole("TEACHER"));

teacherRoutes.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await teacherService.getDashboard(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.get("/subjects", async (req, res, next) => {
  try {
    res.json(await teacherService.listAssignedSubjects(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.get("/questions", async (req, res, next) => {
  try {
    res.json(await teacherService.listQuestions(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.get("/questions/:id", async (req, res, next) => {
  try {
    res.json(await teacherService.getQuestionDetail(req.auth!.userId, req.params.id));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.post("/questions", async (req, res, next) => {
  try {
    const input = createQuestionSchema.parse(req.body);
    res.status(201).json(await teacherService.createDraft(req.auth!.userId, input));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.post("/questions/:id/submit", async (req, res, next) => {
  try {
    res.status(202).json(await teacherService.submitQuestion(req.auth!.userId, req.params.id));
  } catch (err) {
    next(err);
  }
});

teacherRoutes.get("/questions/:id/status", async (req, res, next) => {
  try {
    const question = await teacherService.getQuestionDetail(req.auth!.userId, req.params.id);
    res.json({ status: question.status, aiReport: question.aiReport });
  } catch (err) {
    next(err);
  }
});
