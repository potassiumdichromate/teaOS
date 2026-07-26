import { z } from "zod";
import { BloomLevel, Difficulty } from "../enums.js";

export const questionOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z.object({
  subjectId: z.string().cuid(),
  chapterId: z.string().cuid(),
  text: z.string().min(10),
  options: z.array(questionOptionSchema).min(2).max(6),
  explanation: z.string().min(1),
  difficultySuggested: z.enum(Difficulty),
  bloomLevelSuggested: z.enum(BloomLevel),
  images: z.array(z.string().url()).default([]),
}).refine((v) => v.options.filter((o) => o.isCorrect).length === 1, {
  message: "Exactly one option must be marked correct",
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

// Structured output contract the AI Validation Service requests from
// 0G Compute (see docs/0G_INTEGRATION.md) — treated as advisory, not authoritative.
export const aiValidationReportSchema = z.object({
  duplicatePct: z.number().min(0).max(100),
  similarQuestionIds: z.array(z.string()),
  grammarIssues: z.array(z.object({ text: z.string(), suggestion: z.string() })),
  biasFlags: z.array(z.object({ category: z.string(), detail: z.string() })),
  difficultyPredicted: z.enum(Difficulty),
  bloomLevelPredicted: z.enum(BloomLevel),
  topicClassified: z.string(),
  estimatedSolvingSeconds: z.number().int().positive(),
  weightageSuggested: z.number().min(0).max(1),
});
export type AiValidationReport = z.infer<typeof aiValidationReportSchema>;
