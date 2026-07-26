import { Router } from "express";
import { verifyRequestSchema } from "@nvei/shared";
import { verifyStudentResult } from "../services/verify.service.js";

export const verifyRoutes = Router();

// Public, no auth — a citizen/student verifying their own result must not
// need an account. Every check is itemized in the response, never a single
// opaque boolean — see docs/SYSTEM_ARCHITECTURE.md §5.
verifyRoutes.post("/", async (req, res, next) => {
  try {
    const { applicationId, dob } = verifyRequestSchema.parse(req.body);
    res.json(await verifyStudentResult(applicationId, dob));
  } catch (err) {
    next(err);
  }
});
