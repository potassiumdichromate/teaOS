import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const walletLinkSchema = z.object({
  evmAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  midenAccountId: z.string().optional(),
}).refine((v) => v.evmAddress || v.midenAccountId, {
  message: "At least one of evmAddress or midenAccountId is required",
});
export type WalletLinkInput = z.infer<typeof walletLinkSchema>;
