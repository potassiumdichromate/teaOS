import { z } from "zod";

// Self-enrollment: the student binds themselves to a paper, in their own
// portal — no center staff involved (see knowledge_base.md on the
// 2026-07-30 move away from center-operated enrollment). The service layer
// additionally checks applicationId matches the caller's own profile.
export const selfEnrollSchema = z.object({
  applicationId: z.string().min(1),
  paperId: z.string().cuid(),
  // Demo-grade identity photo, captured client-side (camera or file input)
  // as a data URL. No real face-matching yet — see docs/future-scale-implementation.md.
  photoDataUrl: z.string().optional(),
});
export type SelfEnrollInput = z.infer<typeof selfEnrollSchema>;

export const autosaveAnswerSchema = z.object({
  questionId: z.string().cuid(),
  selectedOptionIndex: z.number().int().min(0).nullable(),
  markedForReview: z.boolean().default(false),
});
export type AutosaveAnswerInput = z.infer<typeof autosaveAnswerSchema>;

export const submitExamSchema = z.object({
  sessionId: z.string().cuid(),
});
export type SubmitExamInput = z.infer<typeof submitExamSchema>;

export const verifyRequestSchema = z.object({
  applicationId: z.string().min(1),
  dob: z.string().date(),
});
export type VerifyRequestInput = z.infer<typeof verifyRequestSchema>;

// Response contract for POST /verify — every check is itemized, never a
// single opaque boolean, per SYSTEM_ARCHITECTURE.md sequence 5.
export const verifyResponseSchema = z.object({
  identityMatch: z.boolean(),
  answerHashMatch: z.boolean(),
  submissionHashMatch: z.boolean(),
  resultHashMatch: z.boolean(),
  onChainCommitmentValid: z.boolean(),
  storageProofValid: z.boolean(),
  chainTxValid: z.boolean(),
  overallVerified: z.boolean(),
  // Demo-grade candidate photo (see docs/future-scale-implementation.md),
  // shown alongside a verified result — absent if the candidate never
  // captured one at enrollment, or identity didn't match.
  photoDataUrl: z.string().optional(),
  details: z.object({
    submissionChainTx: z.string().optional(),
    resultChainTx: z.string().optional(),
    storageRoot: z.string().optional(),
  }),
});
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;
