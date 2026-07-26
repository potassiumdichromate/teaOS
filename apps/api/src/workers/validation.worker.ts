import { Worker } from "bullmq";
import { redisConnection, type ValidationJobData } from "./queues.js";
import { runQuestionPipeline } from "../services/questionPipeline.service.js";
import { logger } from "../lib/logger.js";

export function startValidationWorker(): Worker<ValidationJobData> {
  const worker = new Worker<ValidationJobData>(
    "question-validation",
    async (job) => {
      logger.info({ jobId: job.id, questionId: job.data.questionId }, "Processing question validation job");
      await runQuestionPipeline(job.data.questionId);
    },
    { connection: redisConnection, concurrency: 4 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Question validation job failed");
  });

  return worker;
}
