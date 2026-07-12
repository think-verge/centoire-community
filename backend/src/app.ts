import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/v1", apiRouter);
  // Local-disk image fallback when Cloudinary is not configured
  app.use("/uploads", express.static("uploads", { maxAge: "7d" }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
