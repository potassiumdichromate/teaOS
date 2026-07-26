import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { stub } from "./stub.helper.js";

export const storageRoutes = Router();
storageRoutes.use(requireAuth, requireRole("ADMIN"));

stub(storageRoutes, "get", "/objects", "0G Storage Explorer");
stub(storageRoutes, "get", "/objects/:root/proof", "0G Storage Explorer");
