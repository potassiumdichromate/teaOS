import { Worker } from "bullmq";
import { redisConnection, type EvaluationJobData } from "./queues.js";
import { runEvaluationPipeline } from "../services/evaluation.service.js";
import { logger } from "../lib/logger.js";

export function startEvaluationWorker(): Worker<EvaluationJobData> {
  const worker = new Worker<EvaluationJobData>(
    "evaluation",
    async (job) => {
      logger.info({ jobId: job.id, paperId: job.data.paperId }, "Processing evaluation job");
      await runEvaluationPipeline(job.data.paperId);
    },
    { connection: redisConnection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Evaluation job failed");
  });

  return worker;
}
