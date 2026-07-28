import { z } from "zod";

export const enrollStudentSchema = z.object({
  applicationId: z.string().min(1),
  paperId: z.string().cuid(),
});
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

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
  details: z.object({
    submissionChainTx: z.string().optional(),
    resultChainTx: z.string().optional(),
    storageRoot: z.string().optional(),
  }),
});
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;
