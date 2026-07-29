import { z } from "zod";

export const blueprintSubjectAllocationSchema = z.object({
  subjectId: z.string().cuid(),
  questionCount: z.number().int().positive(),
  marksEach: z.number().int().positive(),
});

export const blueprintChapterAllocationSchema = z.object({
  chapterId: z.string().cuid(),
  difficultyPct: z.object({ EASY: z.number(), MEDIUM: z.number(), HARD: z.number() })
    .refine((v) => v.EASY + v.MEDIUM + v.HARD === 100, { message: "Difficulty % must sum to 100" }),
  questionCount: z.number().int().positive(),
  // Caps which duplication-tagged questions this allocation can draw from —
  // "HIGH" (default) means no extra restriction beyond the intake threshold
  // itself (AI_VALIDATION_THRESHOLDS.maxDuplicatePct); "LOW"/"MEDIUM" let a
  // blueprint demand a stricter pool for a higher-stakes paper.
  maxDuplicationLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("HIGH"),
});

export const createBlueprintSchema = z.object({
  title: z.string().min(3),
  totalMarks: z.number().int().positive(),
  totalQuestions: z.number().int().positive(),
  negativeMarking: z.number().min(0).max(1),
  subjectAllocations: z.array(blueprintSubjectAllocationSchema).min(1),
  chapterAllocations: z.array(blueprintChapterAllocationSchema).min(1),
});
export type CreateBlueprintInput = z.infer<typeof createBlueprintSchema>;

export const generatePaperSchema = z.object({
  blueprintId: z.string().cuid(),
  examStartAt: z.string().datetime(),
  examWindowCloseAt: z.string().datetime(),
}).refine((v) => new Date(v.examWindowCloseAt) > new Date(v.examStartAt), {
  message: "examWindowCloseAt must be after examStartAt",
});
export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;
