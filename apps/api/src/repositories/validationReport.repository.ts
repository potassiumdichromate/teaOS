import { prisma } from "../lib/prisma.js";
import type { AiValidationReport } from "@nvei/shared";

export const validationReportRepository = {
  upsert: (
    questionId: string,
    args: {
      report: AiValidationReport;
      modelName: string;
      providerAddress: string;
      trustMode: string;
      attestationRef?: string;
      passedThresholds: boolean;
    },
  ) =>
    prisma.aIValidationReport.upsert({
      where: { questionId },
      create: {
        questionId,
        duplicatePct: args.report.duplicatePct,
        similarQuestionIds: args.report.similarQuestionIds,
        grammarIssues: args.report.grammarIssues,
        biasFlags: args.report.biasFlags,
        difficultyPredicted: args.report.difficultyPredicted,
        bloomLevelPredicted: args.report.bloomLevelPredicted,
        topicClassified: args.report.topicClassified,
        estimatedSolvingSeconds: args.report.estimatedSolvingSeconds,
        weightageSuggested: args.report.weightageSuggested,
        modelName: args.modelName,
        providerAddress: args.providerAddress,
        trustMode: args.trustMode,
        attestationRef: args.attestationRef,
        passedThresholds: args.passedThresholds,
      },
      update: {
        duplicatePct: args.report.duplicatePct,
        similarQuestionIds: args.report.similarQuestionIds,
        grammarIssues: args.report.grammarIssues,
        biasFlags: args.report.biasFlags,
        difficultyPredicted: args.report.difficultyPredicted,
        bloomLevelPredicted: args.report.bloomLevelPredicted,
        topicClassified: args.report.topicClassified,
        estimatedSolvingSeconds: args.report.estimatedSolvingSeconds,
        weightageSuggested: args.report.weightageSuggested,
        passedThresholds: args.passedThresholds,
      },
    }),

  findByQuestionId: (questionId: string) => prisma.aIValidationReport.findUnique({ where: { questionId } }),
};
