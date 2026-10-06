import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { createErrorHandler, notFoundHandler, requireAllowedOrigin } from "@centoire/server-kit";
import { env, isProduction } from "./config/env.js";
import { adminRouter, employerRouter, jobsRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  // In production nginx serves jobs.centoire.com and /api same-origin, so CORS only matters in dev.
  app.use(cors({ origin: env.CLIENT_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(requireAllowedOrigin(env.CLIENT_ORIGINS));
  // Everything lives under /api/v1/jobs. employer/admin mount first so `/:id` never shadows them.
  api.use("/jobs/employer", employerRouter);
  api.use("/jobs/admin", adminRouter);
  api.use("/jobs", jobsRouter);
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(createErrorHandler({ isProduction }));
  return app;
}
