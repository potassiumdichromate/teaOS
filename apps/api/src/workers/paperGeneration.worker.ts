import { Worker } from "bullmq";
import { redisConnection, type PaperGenerationJobData } from "./queues.js";
import { runPaperGenerationPipeline } from "../services/paperGeneration.service.js";
import { logger } from "../lib/logger.js";

export function startPaperGenerationWorker(): Worker<PaperGenerationJobData> {
  const worker = new Worker<PaperGenerationJobData>(
    "paper-generation",
    async (job) => {
      logger.info({ jobId: job.id, paperId: job.data.paperId }, "Processing paper generation job");
      await runPaperGenerationPipeline(job.data.paperId);
    },
    { connection: redisConnection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Paper generation job failed");
  });

  return worker;
}
