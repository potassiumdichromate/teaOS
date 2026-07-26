import { Router } from "express";
import { loginSchema, walletLinkSchema } from "@nvei/shared";
import * as authService from "../services/auth.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { userRepository } from "../repositories/user.repository.js";

export const authRoutes = Router();

authRoutes.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/wallet-link", requireAuth, async (req, res, next) => {
  try {
    const input = walletLinkSchema.parse(req.body);
    const user = await userRepository.linkWallet(req.auth!.userId, input);
    res.json({ evmAddress: user.evmAddress, midenAccountId: user.midenAccountId });
  } catch (err) {
    next(err);
  }
});
