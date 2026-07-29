import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { teacherRoutes } from "./routes/teacher.routes.js";
import { validationRoutes } from "./routes/validation.routes.js";
import { computeRoutes } from "./routes/compute.routes.js";
import { storageRoutes } from "./routes/storage.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { observerRoutes } from "./routes/observer.routes.js";
import { centerRoutes } from "./routes/center.routes.js";
import { studentRoutes } from "./routes/student.routes.js";
import { verifyRoutes } from "./routes/verify.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "5mb" })); // images are uploaded as URLs, not inline — 5mb covers a large question payload
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/teacher", teacherRoutes);
  app.use("/api/validation", validationRoutes);
  app.use("/api/compute", computeRoutes);
  app.use("/api/storage", storageRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/observer", observerRoutes);
  app.use("/api/center", centerRoutes);
  app.use("/api/student", studentRoutes);
  app.use("/api/verify", verifyRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
