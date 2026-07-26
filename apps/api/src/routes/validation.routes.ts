import { Router } from "express";
import { validationReportRepository } from "../repositories/validationReport.repository.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as teacherService from "../services/teacher.service.js";
import { HttpError } from "../middleware/error.middleware.js";

export const validationRoutes = Router();
validationRoutes.use(requireAuth);

validationRoutes.get("/reports/:questionId", async (req, res, next) => {
  try {
    if (req.auth!.role === "TEACHER") {
      // ownership check reuses the teacher service so a teacher can't read another teacher's report
      await teacherService.getQuestionDetail(req.auth!.userId, req.params.questionId);
    } else if (req.auth!.role !== "ADMIN") {
      throw new HttpError(403, "Requires role: TEACHER or ADMIN");
    }
    const report = await validationReportRepository.findByQuestionId(req.params.questionId);
    if (!report) throw new HttpError(404, "No validation report yet for this question");
    res.json(report);
  } catch (err) {
    next(err);
  }
});

validationRoutes.post("/reevaluate/:questionId", requireRole("ADMIN"), async (_req, res) => {
  res.status(501).json({
    error: "Not implemented — force re-run is planned for the Phase 4 AI Validation Service module",
  });
});
