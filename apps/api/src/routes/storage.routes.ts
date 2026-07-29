import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as storageService from "../services/storage.service.js";

export const storageRoutes = Router();
storageRoutes.use(requireAuth, requireRole("ADMIN", "OBSERVER"));

storageRoutes.get("/objects", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.take ?? 50), 200);
    res.json(await storageService.listObjects(take));
  } catch (err) {
    next(err);
  }
});

storageRoutes.get("/objects/:root/proof", async (req, res, next) => {
  try {
    res.json(await storageService.getProof(req.params.root));
  } catch (err) {
    next(err);
  }
});
