import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { requireAllowedOrigin } from "@centoire/server-kit";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/v1", requireAllowedOrigin(env.CLIENT_ORIGINS), apiRouter);
  // Local-disk image fallback when Cloudinary is not configured
  app.use("/uploads", express.static(env.UPLOAD_DIR, { maxAge: "7d" }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
