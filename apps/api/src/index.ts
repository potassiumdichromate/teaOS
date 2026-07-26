import "./lib/json-bigint.js"; // must be first — patches BigInt serialization before anything else runs
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { registerConnection } from "./ws/hub.js";
import { startValidationWorker } from "./workers/validation.worker.js";
import { startPaperGenerationWorker } from "./workers/paperGeneration.worker.js";
import { startEvaluationWorker } from "./workers/evaluation.worker.js";

const app = createApp();
const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
wss.on("connection", (ws) => registerConnection(ws));

const validationWorker = startValidationWorker();
const paperWorker = startPaperGenerationWorker();
const evaluationWorker = startEvaluationWorker();

httpServer.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, network: env.ZG_NETWORK }, "NVEI API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await Promise.all([validationWorker.close(), paperWorker.close(), evaluationWorker.close()]);
  httpServer.close(() => process.exit(0));
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
