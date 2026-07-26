import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redisConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export interface ValidationJobData {
  questionId: string;
}

export const validationQueue = new Queue<ValidationJobData>("question-validation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export interface PaperGenerationJobData {
  paperId: string;
}

export const paperGenerationQueue = new Queue<PaperGenerationJobData>("paper-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // re-running would re-select/re-encrypt/re-anchor — retries need an explicit admin action, not an automatic one
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export interface EvaluationJobData {
  paperId: string;
}

export const evaluationQueue = new Queue<EvaluationJobData>("evaluation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // re-running would re-score/re-anchor already-evaluated sessions — an explicit admin action, not automatic
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
